import os
from dotenv import load_dotenv
import uuid
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import chromadb
from pypdf import PdfReader
import google.generativeai as genai
import json

app = FastAPI()
#create a pdf upload directory
updir="static/uploads"
os.makedirs(updir,exist_ok=True)

# Serve uploaded PDFs
app.mount(
    "/uploads",
    StaticFiles(directory=updir),
    name="uploads"
)

#1. vectorDB initialization
vector_db=chromadb.PersistentClient(path="./chromaDB")
db_collection=vector_db.get_or_create_collection(name="studylens_notes")

#2. Init LLM
load_dotenv()
genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)
llm=genai.GenerativeModel("gemini-3.1-flash-lite")

#2a Init conversation history
chat_history=[]

# RAG evaluation logs
rag_logs=[]

#3. Init frontend
app.mount("/app",StaticFiles(directory="Static",html=True),name="static")

#4. Chunks init
def chunk_text(text:str,chunk_size:int=1000):
    #split texts to paras
    paragraphs=[p.strip() for p in text.split("\n\n") if p.strip()]
    chunks=[]
    current_chunk=""
    
    for para in paragraphs:
        if(len(current_chunk)+len(para)+1<=chunk_size):
            current_chunk+=para+"\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk=para+"\n\n"
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks
#5. upload
@app.post("/upload")
async def upload_file(file:UploadFile=File(...)):

#save pdf    
    file_path=os.path.join(updir,file.filename)
    with open(file_path,"wb") as buffer:
        buffer.write(await file.read())
#6. Trying to store page no with chunks
    reader=PdfReader(file_path)
    chunks=[]
    metadatas=[]
    
    for page_number,page in enumerate(reader.pages,start=1):
        text=page.extract_text()or""
        page_chunks=chunk_text(text)
        
        for chunk in page_chunks:
            chunks.append(chunk)
            metadatas.append({
                "source":file.filename,
                "page":page_number
            })
#7. Put info in chromaDB
    ids=[str(uuid.uuid4()) for _ in chunks]        
#8. Store chunks in db
    db_collection.add(
        documents=chunks,
        metadatas=metadatas,
        ids=ids
    )
    
    return {"message":f"Processed {file.filename} into {len(chunks)} chunks"}
#9. def query req
class QueryRequest(BaseModel):
    query:str
    document:str
# Make Quiz
class QuizRequest(BaseModel):
    document:str
    num_questions:int=5

#10. handle req
@app.post("/ask")
async def ask_question(request:QueryRequest):
#retrieve relevant chunks
    results=db_collection.query(
        query_texts=[request.query],
        n_results=5,
        where={"source":request.document},
        include=["documents","metadatas","distances"]
    )
    #retrieve distances and data
    distances=results["distances"][0]
    retrieved_docs=results["documents"][0]
    retrieved_metadata=results["metadatas"][0]
    
    #Set a threshold of 1.4 to check if data is in the uploaded pdf
    if distances[0]>1.4:
        return{
            "answer":"I couldn't find enough information in the uploaded documents to answer this question.",
            "sources":[]
        }
#build chat history
    history="\n".join([f"{message['role']}:{message['content']}" for message in chat_history[-6:]])
#11. Create prompt
    context="\n\n".join([
        f"Source: {meta['source']} | Page: {meta['page']}\nContent: {doc}"
        for doc,meta in zip(retrieved_docs,retrieved_metadata)
    ])
    prompt = f"""
    You are StudyLens, an AI study assistant.

    Answer the user's question using ONLY the information provided in the
    document context below. Use the conversation history only to understand
    references such as "it", "they", "this", or "the previous concept".

    Rules:
    1. Do not use outside knowledge.
    2. Do not make up or assume information that is not present in the context.
    3. If the context does not contain enough information to answer, say:
    "I couldn't find enough information in the uploaded documents to answer this question."
    4. Give a clear and concise answer.
    5. When possible, use the terminology and information from the context.
    6. Use bullet points or numbered steps when they make the answer easier to understand.

    Conversation History:
    {history}

    Document Context:
    {context}

    User Question:
    {request.query}

    Answer:
"""
#12. Generate Ans
    response=llm.generate_content(prompt)

# Log RAG evaluation data
    rag_logs.append({
        "question": request.query,
        "document": request.document,
        "retrieved_documents": retrieved_docs,
        "distances": distances,
        "answer": response.text
    })

    #save current convo
    chat_history.append({
        "role":"user",
        "content":request.query
    })
    
    chat_history.append({
        "role":"assistant",
        "content":response.text
    })
    
    
    return{
        "answer":response.text,
        "sources": [
            {
                "content":doc,
                "metadata":meta
            }
            for doc,meta in zip(retrieved_docs,retrieved_metadata)
        ]
    }
# View RAG evaluation metrics
@app.get("/evaluation")
def get_evaluation():

    total_queries = len(rag_logs)

    # No evaluation data yet
    if total_queries == 0:
        return {
            "total_queries": 0,
            "total_retrieved_chunks": 0,
            "average_retrieved_chunks": 0,
            "average_distance": 0,
            "minimum_distance": 0,
            "maximum_distance": 0,
            "queries_below_threshold": 0,
            "queries_above_threshold": 0,
            "threshold": 1.4
        }

    # Evaluation settings
    relevance_threshold = 1.4

    # Retrieval statistics
    total_chunks = 0
    total_distance = 0

    minimum_distance = float("inf")
    maximum_distance = float("-inf")

    queries_below_threshold = 0
    queries_above_threshold = 0

    for log in rag_logs:

        distances = log["distances"]

        if not distances:
            continue

        # Number of retrieved chunks
        total_chunks += len(distances)

        # Distance statistics
        total_distance += sum(distances)

        minimum_distance = min(
            minimum_distance,
            min(distances)
        )

        maximum_distance = max(
            maximum_distance,
            max(distances)
        )

        # Check whether the best retrieved chunk
        # passed our relevance threshold
        best_distance = distances[0]

        if best_distance <= relevance_threshold:
            queries_below_threshold += 1
        else:
            queries_above_threshold += 1

    # Average distance across all retrieved chunks
    average_distance = (
        total_distance / total_chunks
        if total_chunks > 0
        else 0
    )

    # Average number of chunks retrieved per question
    average_retrieved_chunks = (
        total_chunks / total_queries
        if total_queries > 0
        else 0
    )

    # Percentage of queries that passed threshold
    threshold_pass_rate = (
        queries_below_threshold / total_queries * 100
        if total_queries > 0
        else 0
    )

    return {
        # Basic statistics
        "total_queries": total_queries,
        "total_retrieved_chunks": total_chunks,
        "average_retrieved_chunks": average_retrieved_chunks,

        # Distance metrics
        "average_distance": average_distance,
        "minimum_distance": (
            minimum_distance
            if minimum_distance != float("inf")
            else 0
        ),
        "maximum_distance": (
            maximum_distance
            if maximum_distance != float("-inf")
            else 0
        ),

        # Threshold metrics
        "threshold": relevance_threshold,
        "queries_below_threshold": queries_below_threshold,
        "queries_above_threshold": queries_above_threshold,
        "threshold_pass_rate": threshold_pass_rate,

        # Raw evaluation logs
        "logs": rag_logs
    }
    
# Quiz Gen
@app.post("/quiz")
async def generate_quiz(request: QuizRequest):

    results = db_collection.query(
        query_texts=["important concepts, definitions, key facts and main ideas"],
        n_results=10,
        where={"source": request.document},
        include=["documents", "metadatas"]
    )

    retrieved_docs = results["documents"][0]
    retrieved_metadata = results["metadatas"][0]

    context = "\n\n".join([
        f"Source: {meta['source']} | Page: {meta['page']}\nContent: {doc}"
        for doc, meta in zip(
            retrieved_docs,
            retrieved_metadata
        )
    ])

    prompt = f"""
    You are StudyLens, an AI study assistant.

    Create {request.num_questions} multiple-choice questions
    using ONLY the document context below.

    Rules:
    1. Do not use outside knowledge.
    2. Each question must have exactly 4 options.
    3. There must be exactly one correct answer.
    4. Questions should test understanding, not just memorization.
    5. Include a short explanation for the correct answer.
    6. Include the source page for each question.
    7. Do not invent information that is not present in the context.

    Return ONLY valid JSON in this format:

    {{
        "questions": [
            {{
                "question": "Question text",
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D"
                ],
                "correct_answer": "Option A",
                "explanation": "Why this answer is correct",
                "page": 1
            }}
        ]
    }}

    Document Context:
    {context}
    """

    # Generate quiz
    response = llm.generate_content(prompt)
    
    
    # Parse quiz JSON
    quiz_data = json.loads(response.text)

    return quiz_data