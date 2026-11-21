"""Re-creates WhatsApp templates on a WABA from MSG91/Meta template-export JSON files.

Each export (e.g. Downloads/welcome_1.json) holds a template's category, name, language, parameter
format and components. This converts that into the payload Meta's
POST /{WABA_ID}/message_templates expects, so a template that was approved on a lost or old WABA can
be submitted again unchanged.

Reads WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID from ./.env (same as the other
whatsapp_*.py scripts).

Run: python whatsapp_create_templates_from_json.py DIR_OR_FILES...            (preview only)
     python whatsapp_create_templates_from_json.py DIR_OR_FILES... --submit   (actually create)
     add --only name1,name2 to restrict to some templates.

Templates whose name already exists on the WABA are skipped. Meta locks a template name for about
30 days after a rejection or deletion, so preview first.
"""

import glob
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from dotenv import load_dotenv

if os.path.exists(".env"):
    load_dotenv(".env", override=False)

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
VERSION = os.getenv("WHATSAPP_API_VERSION") or "v23.0"
BASE = "https://graph.facebook.com/%s" % VERSION


def call(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": "Bearer %s" % TOKEN, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def convert_component(c):
    t = c["type"]
    if t == "HEADER":
        out = {"type": "HEADER", "format": c.get("format", "TEXT"), "text": c["text"]}
    elif t == "BODY":
        out = {"type": "BODY", "text": c["text"]}
    elif t == "FOOTER":
        out = {"type": "FOOTER", "text": c["text"]}
    elif t == "BUTTONS":
        buttons = []
        for b in c["buttons"]:
            nb = {"type": b["type"], "text": b["text"], "url": b["url"]}
            ex = b.get("example")
            if ex and not any("{{" in e for e in ex):
                nb["example"] = ex
            elif "{{" in b["url"]:
                # A dynamic URL needs a concrete sample; the export's own sample is unusable.
                nb["example"] = [b["url"].split("{{")[0] + "example"]
            buttons.append(nb)
        return {"type": "BUTTONS", "buttons": buttons}
    else:
        raise ValueError("unsupported component type %s" % t)
    if c.get("example"):
        out["example"] = c["example"]
    return out


def convert_authentication(lang):
    body = next(c for c in lang["code"] if c["type"] == "BODY")
    footer = next((c for c in lang["code"] if c["type"] == "FOOTER"), {})
    button = next((c for c in lang["code"] if c["type"] == "BUTTONS"), {"buttons": [{}]})["buttons"][0]
    components = [
        {"type": "BODY", "add_security_recommendation": bool(body.get("add_security_recommendation"))},
    ]
    if footer.get("code_expiration_minutes"):
        components.append({"type": "FOOTER", "code_expiration_minutes": int(footer["code_expiration_minutes"])})
    components.append(
        {
            "type": "BUTTONS",
            "buttons": [{"type": "OTP", "otp_type": "COPY_CODE", "text": button.get("text", "Copy code")}],
        }
    )
    return components


def convert(doc):
    lang = doc["languages"][0]
    payload = {
        "name": doc["name"],
        "language": lang["language"],
        "category": doc["category"],
    }
    if doc["category"] == "AUTHENTICATION":
        payload["components"] = convert_authentication(lang)
    else:
        payload["parameter_format"] = lang.get("parameter_format", "POSITIONAL")
        payload["components"] = [convert_component(c) for c in lang["code"]]
    return payload


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    submit = "--submit" in sys.argv
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
        args = [a for a in args if a != sys.argv[sys.argv.index("--only") + 1]]

    if not TOKEN or not WABA_ID:
        raise SystemExit("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env")

    files = []
    for a in args:
        files += sorted(glob.glob(os.path.join(a, "*.json"))) if os.path.isdir(a) else [a]
    if not files:
        raise SystemExit("Pass a directory or JSON files.")

    existing, err = call("GET", "%s/%s/message_templates?fields=name&limit=200" % (BASE, WABA_ID))
    if err:
        raise SystemExit("Could not list existing templates: %s" % err[:400])
    have = {t["name"] for t in existing.get("data", [])}
    print("WABA %s currently has %d templates\n" % (WABA_ID, len(have)))

    for f in files:
        with open(f, encoding="utf-8") as fh:
            doc = json.load(fh)
        if "languages" not in doc:
            continue
        name = doc["name"]
        if only and name not in only:
            continue
        if name in have:
            print("SKIP   %-40s already exists" % name)
            continue
        payload = convert(doc)
        if not submit:
            print("PREVIEW %-40s %s, %s, %d components" % (name, payload["category"], payload.get("parameter_format", "-"), len(payload["components"])))
            continue
        data, err = call("POST", "%s/%s/message_templates" % (BASE, WABA_ID), payload)
        if err:
            print("FAILED %-40s %s" % (name, err.strip()[:500]))
            if "2494160" in err:
                raise SystemExit("\nWABA is not allowed to manage templates yet - stopping.")
        else:
            print("OK     %-40s id=%s status=%s" % (name, data.get("id"), data.get("status")))

    if not submit:
        print("\nPreview only - rerun with --submit to create these on Meta.")


if __name__ == "__main__":
    main()
