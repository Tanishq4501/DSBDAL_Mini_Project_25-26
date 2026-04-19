# FraudShield — Fraud Detection in Banking Transactions
### DSBDAL Mini Project

> **Subject:** Data Science & Big Data Analytics Lab (DSBDAL)
> **Dataset:** Kaggle Credit Card Fraud Detection (284,807 transactions, 0.17% fraud)
> **Stack:** Python · FastAPI · React.js · Scikit-Learn · XGBoost · PySpark · Docker · Apache Hadoop · Apache Kafka

---

## Project Structure

```
DSBDAL_Mini_Project/
├── backend/                    # Python FastAPI + ML
│   ├── app.py                  # FastAPI server (run this)
│   ├── src/
│   │   ├── preprocess.py       # Data cleaning, scaling, SMOTE
│   │   ├── models.py           # LR, RF, XGBoost, IsolationForest
│   │   ├── evaluate.py         # Metrics, ROC/PR curves
│   │   ├── spark_pipeline.py   # PySpark MLlib pipeline
│   │   ├── mapreduce_fraud.py  # Local MapReduce fallback / aggregation utilities
│   │   └── hadoop_streaming/   # Real Hadoop Streaming mapper / reducer / submitter
│   │   ├── kafka_producer.py   # Kafka transaction streamer
│   │   └── kafka_consumer_predict.py  # Spark Structured Streaming
│   ├── notebooks/
│   │   ├── 01_EDA.ipynb
│   │   ├── 02_Preprocessing_Models.ipynb
│   │   ├── 03_Evaluation.ipynb
│   │   ├── 04_BigData_Spark_BDA.ipynb
│   │   └── 05_Streaming_Kafka.ipynb
│   ├── models/                 # Saved .pkl model files (after training)
│   ├── data/                   # Place creditcard.csv here
│   ├── reports/figures/        # Auto-saved plots
│   └── requirements.txt
│
├── frontend/                   # React.js Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Overview stats + charts
│   │   │   ├── EDA.jsx         # Exploratory Analysis
│   │   │   ├── Models.jsx      # Model comparison
│   │   │   ├── Predict.jsx     # Single transaction prediction
│   │   │   └── Stream.jsx      # Live transaction stream
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── StatsCard.jsx
│   │   └── api/api.js
│   └── package.json
│
└── README.md
```

---

## Quick Start

### Docker Stack

The fastest way to run the streaming demo is with Docker Compose:

```bash
docker compose up --build
```

This starts:

- `namenode`: HDFS metadata and cluster coordination
- `datanode1` and `datanode2`: HDFS storage workers
- `resourcemanager`: YARN scheduler for MapReduce jobs
- `nodemanager1` and `nodemanager2`: MapReduce worker containers
- `historyserver`: YARN history UI
- `jobsubmitter`: runs a real Hadoop Streaming job against the YARN cluster
- `kafka`: the Apache Kafka broker used for the live transaction stream
- `generator`: a dedicated container that publishes synthetic transactions
- `backend`: FastAPI + ML API and WebSocket stream
- `frontend`: the React dashboard

Open the dashboard at http://localhost:5173 and the API at http://localhost:8000.

### 1. Get the Dataset
Download `creditcard.csv` from [Kaggle](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) and place it in `backend/data/`.

> **Note:** The app works without the dataset — it uses realistic mock data for demo.

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run API server
uvicorn app:app --reload --port 8000
```

API available at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at: http://localhost:5173

---

## ML Models

| Model | Type | Precision | Recall | F1 | ROC-AUC |
|-------|------|-----------|--------|----|---------|
| Logistic Regression | Baseline | 0.87 | 0.76 | 0.81 | 0.977 |
| Random Forest | Ensemble | 0.96 | 0.82 | 0.88 | 0.985 |
| **XGBoost** | **Best** | **0.94** | **0.84** | **0.89** | **0.987** |
| Isolation Forest | Anomaly | 0.34 | 0.28 | 0.31 | 0.633 |

**Key metric: Recall** — catching real fraud matters more than false alarms.

---

## Big Data Components

- **PySpark:** Distributed ML pipeline across a Spark cluster
- **HDFS:** Apache Hadoop NameNode + DataNode storage cluster
- **YARN / MapReduce:** ResourceManager + NodeManager workers for job execution
- **Kafka:** Apache Kafka broker for real-time transaction streaming at 50 tx/sec
- **Transaction Generator:** Dedicated container publishing synthetic transactions
- **Hadoop Streaming:** Python mapper/reducer jobs executed on YARN workers

The streaming job copies `creditcard.csv` into HDFS, runs a Python mapper and reducer via Hadoop Streaming, and writes aggregated output back to HDFS.

The dashboard now shows the NameNode, DataNodes, ResourceManager, NodeManagers, Kafka broker, and transaction generator as containerized parts of the stack instead of simulated placeholders.

### Train Models

```bash
# From backend directory
python -c "
from src.preprocess import prepare_data
from src.models import train_all_models
X_train, X_test, y_train, y_test = prepare_data('data/creditcard.csv')
train_all_models(X_train, y_train, 'models/')
"
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dataset/info` | Dataset statistics |
| GET | `/api/eda/class-distribution` | Fraud vs legit counts |
| GET | `/api/eda/amount-stats` | Amount stats by class |
| GET | `/api/eda/feature-correlations` | Top feature correlations |
| GET | `/api/models/metrics` | All model performance metrics |
| POST | `/api/predict` | Predict single transaction |
| GET | `/api/train` | Trigger model training |
| WS | `/ws/stream` | Real-time transaction stream |

---

## Dataset

- **Source:** [Kaggle Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud)
- **Size:** 284,807 transactions (~144 MB)
- **Fraud:** 492 transactions (0.17%)
- **Features:** Time, V1-V28 (PCA anonymized), Amount, Class

---

*DSBDAL Mini Project — Fraud Detection in Banking Transactions*
