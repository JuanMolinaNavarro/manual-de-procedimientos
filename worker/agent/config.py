import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

FINNEGANS_LOGIN_URL: str = "https://services.finneg.com/login"
FINNEGANS_FACTURAS_URL: str = "https://go.finneg.com/mas/vista?viewID=149"
FINNEGANS_USER: str = os.getenv("FINNEGANS_USER", "")
FINNEGANS_PASS: str = os.getenv("FINNEGANS_PASS", "")
FINNEGANS_WORKSPACE: str = os.getenv("FINNEGANS_WORKSPACE", "MULTIMEDIOS")
HEADLESS: bool = os.getenv("HEADLESS", "false").lower() == "true"
