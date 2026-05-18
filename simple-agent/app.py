from langgraph.checkpoint.memory import InMemorySaver
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate

from RAG.retriever import get_retriever

retriever = get_retriever()

# ----------------------------
# System Prompt
# ----------------------------
system_prompt = """
You are an AI assistant with access to tools.

Rules:
- Use search_docs for document-related questions
- Use calculator for math problems
- Use search_database for structured queries
- Be precise and avoid unnecessary tool usage
"""

# ----------------------------
# Tools
# ----------------------------
@tool
def search_docs(query: str) -> str:
    """Search local documents and return relevant text."""
    docs = retriever.get_relevant_documents(query)
    return "\n".join(doc.page_content for doc in docs)


@tool
def calculator(query: str) -> str:
    """Solve simple math expressions."""
    try:
        return str(eval(query, {"__builtins__": {}}))
    except:
        return "Error in calculation"


@tool
def search_database(query: str, limit: int = 10) -> str:
    """Search customer database."""
    return f"Found {limit} results for '{query}'"


tools = [search_docs, calculator, search_database]

# ----------------------------
# LLM
# ----------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0
)

# ----------------------------
# Prompt WITH system message
# ----------------------------
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}")  # required for tool reasoning
])

# ----------------------------
# Agent (NO executor, NO initialize_agent)
# ----------------------------
agent = create_agent(
    model=llm,
    tools=tools,
    prompt=prompt,
    checkpointer=InMemorySaver(),
)

# ----------------------------
# Loop (depends on implementation: invoke)
# ----------------------------
while True:
    user_input = input("You: ")
    if user_input.lower() == "exit":
        break

    result = agent.invoke({"input": user_input})
    print("AI:", result["output"])
