## Semantic Caching

Dont even need a full vector DB at first.
Could store:
```
topic
embedding
graph_json
```
in PostgreSQL with pgvector.

Then search:
```
SELECT graph
ORDER BY embedding <-> query_embedding
LIMIT 1
```

If similarity high → return cached graph.


Semantic caching is:
```
less compute
+
faster responses
+
smarter system
```