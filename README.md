# StudyLens

An AI-powered RAG study assistant that allows users to upload PDF notes, ask questions about their documents, inspect source passages, and generate quizzes from their study material.

StudyLens is built to keep answers grounded in the user's uploaded documents using Retrieval-Augmented Generation (RAG).

---

## Features

### PDF Upload

Upload one or multiple PDF documents into StudyLens.

### Document Selection

Select the document you want to use for question answering and quiz generation.

### RAG-Based Question Answering

Ask questions about uploaded notes and receive answers generated from retrieved document context.

The pipeline works as follows:

1. User submits a question.
2. StudyLens searches the selected document using ChromaDB.
3. The most relevant chunks are retrieved.
4. Retrieved chunks are checked against a relevance threshold.
5. Relevant chunks are combined into a context.
6. The context is passed to Google Gemini.
7. Gemini generates a grounded answer.
8. The answer is returned together with source information.

### Page-Aware Sources

Each document chunk stores its original PDF page number.

This allows StudyLens to show where the retrieved information came from.

### Clickable Source Passages

Source passages displayed below answers are clickable.

Clicking a source opens the uploaded PDF at the corresponding page.

### Smart Chunking

PDF text is divided into paragraph-aware chunks rather than blindly splitting text at arbitrary positions.

This helps preserve the structure and meaning of the original document.

### Conversation History

Recent conversation history is provided to the model so that follow-up questions can understand references such as:

- "it"
- "this"
- "they"
- "the previous concept"

### Relevance Threshold

StudyLens checks the retrieval distance of the best matching chunk before generating an answer.

If the retrieved context does not pass the configured threshold, StudyLens returns:

> I couldn't find enough information in the uploaded documents to answer this question.

This helps prevent answers from being generated from weak or unrelated context.

### AI-Generated Quizzes

StudyLens can generate a five-question multiple-choice quiz from the selected document.

Each question contains:

- Question
- Four answer options
- Correct answer
- Explanation
- Source page

### Quiz Scoring

The quiz tracks:

- Correct answers
- Incorrect answers
- Final score

### Retry Incorrect Questions

After completing a quiz, users can retry only the questions they answered incorrectly.

### RAG Evaluation

StudyLens includes an evaluation endpoint for inspecting retrieval behavior.

Current evaluation statistics include:

- Total queries
- Total retrieved chunks
- Average chunks retrieved per query
- Average retrieval distance
- Minimum retrieval distance
- Maximum retrieval distance
- Queries below the relevance threshold
- Queries above the relevance threshold
- Threshold pass rate
- Raw RAG evaluation logs

---

## Architecture

```text
                         User
                          |
                          v
                HTML / CSS / JavaScript
                          |
                          v
                       FastAPI
                          |
             +------------+------------+
             |                         |
             v                         v
        PDF Processing             ChromaDB
             |                  Vector Retrieval
             v                         |
       Smart Chunking                  |
             |                         |
             +------------+------------+
                          |
                          v
                  Retrieved Context
                          |
                          v
                   Google Gemini
                          |
                          v
                  Answer + Sources
```

---

## RAG Pipeline

```text
PDF
 |
 v
Text Extraction
 |
 v
Page-Aware Chunking
 |
 v
ChromaDB
 |
 v
User Question
 |
 v
Similarity Search
 |
 v
Top Relevant Chunks
 |
 v
Relevance Threshold
 |
 v
Grounded Prompt
 |
 v
Google Gemini
 |
 v
Answer + Sources
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Python | Backend language |
| FastAPI | REST API |
| ChromaDB | Vector database and retrieval |
| Google Gemini | LLM generation |
| pypdf | PDF text extraction |
| Pydantic | Request validation |
| HTML | Frontend structure |
| CSS | Frontend styling |
| JavaScript | Frontend logic |

---

## Project Structure

```text
StudyLens/
|
├── main.py
├── requirements.txt
├── README.md
├── .gitignore
|
├── Static/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── home.html
│   ├── home.js
│   └── home.css
|
└── static/
    └── uploads/
```

Runtime directories such as ChromaDB data and uploaded PDFs should not be committed to Git.

---

# Installation

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/StudyLens.git
```

Move into the project directory:

```bash
cd StudyLens
```

---

## 2. Create a Virtual Environment

### Windows

```powershell
py -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

---

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

If the `pip` command is unavailable, use:

```bash
python -m pip install -r requirements.txt
```

On Windows, you can also use:

```powershell
py -m pip install -r requirements.txt
```

---

# Environment Variables

StudyLens requires a Google Gemini API key.

Create a `.env` file in the project root:

```text
StudyLens/
|
├── .env
├── main.py
└── ...
```

Add:

```env
GEMINI_API_KEY=your_gemini_api_key
```

The API key should never be hardcoded into the source code.

The `.env` file is included in `.gitignore` and should never be committed to GitHub.

---

# Running StudyLens Locally

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The application will normally be available at:

```text
http://127.0.0.1:8000
```

Open the application at:

```text
http://127.0.0.1:8000/app
```

FastAPI's interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

# API Endpoints

## POST `/upload`

Uploads a PDF and processes its contents.

### Processing

```text
PDF
 |
 v
Text Extraction
 |
 v
Page-Aware Chunking
 |
 v
ChromaDB
```

---

## POST `/ask`

Answers a question using the selected document.

### Request

```json
{
    "query": "What is CPU?",
    "document": "example.pdf"
}
```

### Response

```json
{
    "answer": "The CPU is...",
    "sources": [
        {
            "content": "...",
            "metadata": {
                "source": "example.pdf",
                "page": 2
            }
        }
    ]
}
```

---

## POST `/quiz`

Generates a multiple-choice quiz from a selected document.

### Request

```json
{
    "document": "example.pdf",
    "num_questions": 5
}
```

### Response

```json
{
    "questions": [
        {
            "question": "Example question?",
            "options": [
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            "correct_answer": "Option A",
            "explanation": "Explanation...",
            "page": 2
        }
    ]
}
```

---

## GET `/evaluation`

Returns RAG evaluation statistics and raw evaluation logs.

Example:

```json
{
    "total_queries": 1,
    "total_retrieved_chunks": 5,
    "average_retrieved_chunks": 5,
    "average_distance": 1.14,
    "minimum_distance": 1.12,
    "maximum_distance": 1.15,
    "threshold": 1.4,
    "queries_below_threshold": 1,
    "queries_above_threshold": 0,
    "threshold_pass_rate": 100
}
```

---

# RAG Evaluation

StudyLens records retrieval information for each question.

Each evaluation log contains:

```text
Question
Document
Retrieved chunks
Retrieval distances
Generated answer
```

The `/evaluation` endpoint calculates basic retrieval statistics.

## Current Metrics

### Total Queries

The number of questions processed by the RAG pipeline.

### Total Retrieved Chunks

The total number of chunks retrieved across all queries.

### Average Retrieved Chunks

The average number of chunks retrieved for each question.

### Average Distance

The average ChromaDB retrieval distance across retrieved chunks.

### Minimum Distance

The smallest retrieval distance observed.

### Maximum Distance

The largest retrieval distance observed.

### Queries Below Threshold

The number of queries where the best retrieved chunk passed the configured relevance threshold.

### Queries Above Threshold

The number of queries where the best retrieved chunk did not pass the configured relevance threshold.

### Threshold Pass Rate

The percentage of queries where the best retrieved chunk passed the configured relevance threshold.

---

# Relevance Threshold

StudyLens currently uses:

```python
relevance_threshold = 1.4
```

The best retrieved chunk is checked against this threshold.

```python
if best_distance <= relevance_threshold:
    ...
```

If the best retrieval result does not pass the threshold, StudyLens does not generate a normal answer and instead returns:

```text
I couldn't find enough information in the uploaded documents to answer this question.
```

The threshold is an application-specific retrieval heuristic. It should be calibrated against a representative evaluation dataset before being treated as a general measure of retrieval quality.

---

# Testing

After starting the server, open:

```text
http://127.0.0.1:8000/docs
```

FastAPI Swagger UI can be used to test the backend.

Recommended testing flow:

```text
1. POST /upload
2. POST /ask
3. POST /quiz
4. GET /evaluation
```

---

# Security

Never commit API keys to GitHub.

The following files and directories should remain local:

```text
.env
chromaDB/
chroma_db/
static/uploads/
__pycache__/
.venv/
```

The repository's `.gitignore` is configured to prevent these from being committed.

If an API key is accidentally committed to a public repository, revoke or rotate the key immediately.

---

# Deployment

StudyLens can be deployed as a FastAPI application on a cloud platform that supports Python web applications.

A production deployment requires the Gemini API key to be configured as an environment variable through the hosting provider.

Set:

```text
GEMINI_API_KEY
```

in the hosting provider's environment variable settings.

Do not place the production API key directly in the source code.

## Storage Consideration

The current application stores:

- Uploaded PDFs
- ChromaDB data

on the local filesystem.

Many cloud hosting platforms use ephemeral filesystems. This means locally stored runtime data may be deleted after a restart or redeployment.

For a production deployment where uploaded documents need to persist, consider using:

- Persistent disk storage
- Object storage for uploaded PDFs
- A hosted or persistent vector database

---

# Current Project Status

| Feature | Status |
|---|---|
| PDF upload | Complete |
| Multiple PDF upload | Complete |
| Document selection | Complete |
| Page-aware chunks | Complete |
| Smart chunking | Complete |
| ChromaDB retrieval | Complete |
| RAG question answering | Complete |
| Conversation history | Complete |
| Relevance threshold | Complete |
| Clickable source passages | Complete |
| MCQ generation | Complete |
| Quiz scoring | Complete |
| Retry incorrect questions | Complete |
| RAG evaluation logging | Complete |
| Retrieval statistics | Complete |
| `/evaluation` endpoint | Complete |

---

# Future Improvements

Potential future improvements include:

- Retrieval Precision
- Retrieval Recall
- Context Relevance
- Answer Relevance
- Faithfulness / Groundedness evaluation
- Dedicated RAG evaluation datasets
- Adaptive quizzes
- Difficulty selection
- Topic-based quizzes
- Persistent cloud storage
- Authentication
- User-specific document collections
- Streaming responses
- Persistent conversation history
- Improved chunking strategies
- Hybrid search
- Retrieval reranking
- Semantic caching

---

# Contributing

Contributions are welcome.

## 1. Fork the repository

Create a fork of the project on GitHub.

## 2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

## 3. Make your changes

Implement and test your changes locally.

## 4. Commit your changes

```bash
git add .
git commit -m "Add your feature"
```

## 5. Push your branch

```bash
git push origin feature/your-feature
```

## 6. Open a Pull Request

Open a pull request from your feature branch to the main branch.

---

# License

This project is currently intended as a personal and educational project.
---

# Author

## Ayush Sharma

StudyLens was built as a hands-on project exploring:

- Retrieval-Augmented Generation
- Vector databases
- Large language model applications
- Document processing
- RAG evaluation
- FastAPI backend development
- Full-stack AI application development
