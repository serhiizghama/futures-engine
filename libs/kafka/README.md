# libs/kafka

NestJS-friendly wrappers for Kafka producer/consumer.

Provide:
- KafkaProducer: send(topic, key, value, headers)
- KafkaConsumer: subscribe(topic, groupId, handler)
- Retry/backoff utilities and DLQ helper
