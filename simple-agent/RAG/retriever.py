from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def get_retriever():
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

    db = Chroma(
        persist_directory="db",
        embedding_function=embeddings
    )

    return db.as_retriever()