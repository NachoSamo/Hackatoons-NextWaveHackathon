# Control Tower

> Working product name for NextWave Hackathon 2026 · Challenge 2 by Yuno.

**Explainable incident intelligence for payment operations.**

## The problem

Payment conversion can drop inside one provider, country, payment method or issuing bank while
merchants lose revenue by the minute. Existing dashboards expose the symptom, but operations teams
still have to cross thousands of transactions to isolate the root cause and explain it.

## The solution

Control Tower watches a live transaction stream, separates meaningful conversion drops from normal
variation and localizes the smallest affected segment across merchant, provider, method, country and
issuer. It produces an evidence-backed diagnosis, estimated revenue impact and recommended next
step for both operations and executive audiences—and says when the evidence is insufficient.

## Architecture

See [`harness/docs/arquitectura.md`](harness/docs/arquitectura.md).

## Stack
Python · FastAPI · PostgreSQL · TypeScript · React · Tailwind · OpenAI API

## Running locally
```bash
# backend
pip install -r requirements.txt
uvicorn main:app --reload

# frontend
npm install && npm run dev
```

## Team
Samo · Juani · Luca · Pena — NextWave Hackathon 2026, Buenos Aires
