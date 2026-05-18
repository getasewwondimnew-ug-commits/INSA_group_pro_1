from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def ingest():
    loader = TextLoader("data/notes.txt")
    docs = loader.load()

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

    db = Chroma.from_documents(docs, embeddings, persist_directory="db")
    db.persist()

if __name__ == "__main__":
    ingest()