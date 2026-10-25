import json
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
MENU_FILE = BASE_DIR / "menu.json"
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen2.5:1.5b"
OLLAMA_KEEP_ALIVE = "30m"

app = FastAPI(title="Local Ollama Restaurant Chatbot")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.on_event("startup")
async def warm_up_model():
    """Preload the model into Ollama's memory so the first real user message
    doesn't pay the ~1 minute model-load cost."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": "hi"}],
                    "stream": False,
                    "keep_alive": OLLAMA_KEEP_ALIVE,
                },
            )
    except httpx.HTTPError:
        pass


def load_menu() -> list[dict]:
    with open(MENU_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_system_prompt(lang: Literal["tr", "en"]) -> str:
    menu_items = load_menu()

    lines = []
    for item in menu_items:
        desc = item["description_tr"] if lang == "tr" else item["description_en"]
        avail_label_tr = "Mevcut" if item["available"] else "Bugün tükendi"
        avail_label_en = "Available" if item["available"] else "Sold out today"
        avail_label = avail_label_tr if lang == "tr" else avail_label_en
        category = item["category"] if lang == "tr" else item["category_en"]

        tags = []
        if item.get("vegetarian"):
            tags.append("Vejetaryen" if lang == "tr" else "Vegetarian")
        if item.get("spicy"):
            tags.append("Acılı" if lang == "tr" else "Spicy")
        tags_text = f" | {', '.join(tags)}" if tags else ""

        lines.append(
            f"- {item['name']} ({category}) | {item['price']} {item['currency']} | "
            f"{avail_label}{tags_text} | {desc}"
        )
    catalog_text = "\n".join(lines)

    if lang == "tr":
        return (
            "Sen 'Barışın Restoranı' için çalışan yardımcı ve güler yüzlü bir garson asistanısın. "
            "Yalnızca aşağıda listelenen menüdeki bilgileri kullanarak yanıt ver. "
            "Menüde olmayan bir yemek sorulursa, bu yemeğin menüde bulunmadığını belirt. "
            "Fiyat ve mevcut durumu (stokta/tükendi) net ve doğru şekilde ilet, istenirse kategoriye veya "
            "vejetaryen/acılı etiketlerine göre öneri yap. "
            "Kısa, samimi ve yardımsever bir dille cevap ver. Her zaman Türkçe yanıt ver.\n\n"
            f"Restoran Menüsü:\n{catalog_text}"
        )
    return (
        "You are a friendly and helpful waiter assistant working for 'Barışın Restoranı' (Barış's Restaurant). "
        "Only answer using the information in the menu listed below. "
        "If a customer asks about a dish that is not on the menu, tell them it is not available. "
        "Communicate prices and availability clearly and accurately, and suggest dishes by category or by "
        "vegetarian/spicy tags when asked. "
        "Keep answers concise, friendly, and helpful. Always respond in English.\n\n"
        f"Restaurant Menu:\n{catalog_text}"
    )


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    lang: Literal["tr", "en"] = "tr"


class ChatResponse(BaseModel):
    reply: str


@app.get("/")
def serve_index():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/menu")
def get_menu():
    return load_menu()


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    system_prompt = build_system_prompt(req.lang)
    ollama_messages = [{"role": "system", "content": system_prompt}]
    ollama_messages.extend({"role": m.role, "content": m.content} for m in req.messages)

    payload = {
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
            resp.raise_for_status()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama sunucusuna bağlanılamadı. 'ollama serve' çalışıyor mu kontrol edin.",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Ollama hata döndürdü: {e}")

    data = resp.json()
    reply = data.get("message", {}).get("content", "")
    return ChatResponse(reply=reply)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
