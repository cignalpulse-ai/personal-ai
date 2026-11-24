import os
import ollama
from groq import Groq
from google import genai
from google.genai import types

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-20b")

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY")) if os.getenv("GROQ_API_KEY") else None
_gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY")) if os.getenv("GEMINI_API_KEY") else None


def get_embedding(text: str) -> list[float]:
    if LLM_PROVIDER == "cloud" and _gemini_client:
        res = _gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768),
        )
        return res.embeddings[0].values

    res = ollama.embeddings(model="nomic-embed-text", prompt=text)
    return res["embedding"]


def chat_completion(messages: list[dict], json_mode: bool = False) -> str:
    if LLM_PROVIDER == "cloud" and _groq_client:
        kwargs = {
            "model": GROQ_CHAT_MODEL,
            "messages": messages,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        res = _groq_client.chat.completions.create(**kwargs)
        return res.choices[0].message.content or ""

    kwargs = {
        "model": "llama3.2:3b",
        "messages": messages,
        "options": {"keep_alive": "30m"},
    }
    if json_mode:
        kwargs["format"] = "json"
    res = ollama.chat(**kwargs)
    return res["message"]["content"]


def stream_chat_completion(messages: list[dict]):
    if LLM_PROVIDER == "cloud" and _groq_client:
        stream = _groq_client.chat.completions.create(
            model=GROQ_CHAT_MODEL,
            messages=messages,
            stream=True,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
        return

    stream = ollama.chat(
        model="llama3.2:3b",
        messages=messages,
        stream=True,
        options={"keep_alive": "30m"},
    )
    for chunk in stream:
        token = chunk["message"]["content"]
        if token:
            yield token