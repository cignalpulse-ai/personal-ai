from datetime import datetime, timedelta
from sqlalchemy import or_
from database import SessionLocal
from models import DocumentEmbedding, RoutineCompletion, User
import llm_client

PERSONA_PROMPTS = {
    "default": "Be helpful, concise, and direct.",
    "professional": "You are a formal, highly structured business assistant. Use professional language, avoid slang, and format your answers clearly.",
    "friendly": "You are a warm, encouraging, and casual friend. Be supportive, use friendly language, and keep the tone light.",
    "sarcastic": "You are a witty, slightly sarcastic assistant. Be helpful, but do not miss an opportunity to make a dry joke or a blunt comment.",
    "zen": "You are a calm, mindful Zen master. Speak slowly, use philosophical phrasing, and encourage peace and balance."
}


def get_embedding(text: str):
    return llm_client.get_embedding(text)


def get_user_prompt(email: str):
    """Fetches the system prompt from the database."""
    if not email:
        return "You are a helpful personal assistant."
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user and user.system_prompt:
            return user.system_prompt
        return "You are a helpful personal assistant."
    finally:
        db.close()


def store_vector(doc_id: str, text: str, user_email: str | None = None):
    vec = get_embedding(text)
    db = SessionLocal()
    try:
        db.query(DocumentEmbedding).filter(DocumentEmbedding.id == doc_id).delete()
        new_doc = DocumentEmbedding(
            id=doc_id,
            user_email=user_email,
            content=text,
            embedding=vec
        )
        db.add(new_doc)
        db.commit()
    except Exception as e:
        print(f"Error storing vector: {e}")
        db.rollback()
    finally:
        db.close()


def _build_messages(
    question: str,
    history: list | None = None,
    persona: str = "default",
    user_email: str = ""
) -> tuple[list[dict], str]:
    history = history or []
    system_prompt = get_user_prompt(user_email)
    context = "No personal memory found."

    db = SessionLocal()
    try:
        try:
            query_vec = get_embedding(question)
            vec_query = db.query(DocumentEmbedding)
            if user_email:
                vec_query = vec_query.filter(DocumentEmbedding.user_email == user_email)
            results = vec_query.order_by(
                DocumentEmbedding.embedding.cosine_distance(query_vec)
            ).limit(3).all()

            if results:
                context = "\n---\n".join([r.content for r in results])
        except Exception as e:
            print(f"Error searching vectors: {e}")

        try:
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            if user_email:
                completions = db.query(RoutineCompletion).filter(
                    or_(
                        RoutineCompletion.email == user_email,
                        RoutineCompletion.user_name == user_email
                    ),
                    RoutineCompletion.completed_at >= thirty_days_ago
                ).order_by(RoutineCompletion.completed_at.desc()).all()

                if completions:
                    completion_stats = "\n\n---\nRecent Routine Completions (Last 30 Days):\n"
                    for c in completions:
                        completion_stats += f"- {c.task} (completed on {c.completed_at.strftime('%Y-%m-%d')})\n"
                    context += completion_stats
        except Exception as e:
            print(f"Error searching completions: {e}")
    finally:
        db.close()

    persona_instruction = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["default"])
    final_system_prompt = f"{system_prompt}\n\nPERSONA INSTRUCTION: {persona_instruction}"

    messages = [
        {"role": "system", "content": f"{final_system_prompt}\n\nRetrieved Personal Context:\n{context}"}
    ]

    for msg in history[-10:]:
        if isinstance(msg, dict) and msg.get("role") in ("user", "assistant", "system") and msg.get("content") is not None:
            messages.append({"role": msg["role"], "content": str(msg["content"])})

    messages.append({"role": "user", "content": question})
    return messages, context


def generate_chat_response(question: str, history: list = [], persona: str = "default", user_email: str = ""):
    messages, context = _build_messages(question, history, persona, user_email)
    answer = llm_client.chat_completion(messages)
    return answer, context


def stream_chat_response(question: str, history: list = [], persona: str = "default", user_email: str = ""):
    messages, _ = _build_messages(question, history, persona, user_email)
    yield from llm_client.stream_chat_completion(messages)