"""One-off: generate an illustration per catalog product (gpt-image-1), store it in object storage, save path on the product.
Run: cd /app/backend && python gen_product_images.py  (skips products that already have an image)."""
import asyncio
import io
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
import base64  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

from storage import APP_NAME, put_object  # noqa: E402

STYLE = ("Soft editorial product illustration of {name} ({desc}). Single object centered, gentle hand-drawn gouache style, "
         "muted warm palette of sage green, cream, sand and soft peach, plain warm cream background (#F8F5F0), soft shadow, no text, no logos, no people.")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    sem = asyncio.Semaphore(4)

    async def one(p):
        async with sem:
            try:
                chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"img-{p['id']}", system_message="You create product illustrations.")
                chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
                _, imgs = await chat.send_message_multimodal_response(UserMessage(text=STYLE.format(name=p["name"], desc=p["description"])))
                data = base64.b64decode(imgs[0]["data"])
                try:
                    from PIL import Image
                    im = Image.open(io.BytesIO(data)).convert("RGB")
                    im.thumbnail((640, 640))
                    buf = io.BytesIO()
                    im.save(buf, "JPEG", quality=82)
                    data, ctype, ext = buf.getvalue(), "image/jpeg", "jpg"
                except Exception:
                    ctype, ext = "image/png", "png"
                path = f"{APP_NAME}/products/{p['id']}.{ext}"
                res = await asyncio.to_thread(put_object, path, data, ctype)
                await db.products.update_one({"id": p["id"]}, {"$set": {"image": f"/api/media/{res['path']}", "image_kind": "illustration"}})
                print("ok", p["id"], flush=True)
            except Exception as e:
                print("fail", p["id"], e, flush=True)

    todo = [p async for p in db.products.find({"$or": [{"image": None}, {"image": {"$exists": False}}]})]
    print("todo", len(todo), flush=True)
    await asyncio.gather(*(one(p) for p in todo))


asyncio.run(main())
