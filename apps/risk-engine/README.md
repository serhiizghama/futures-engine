# Risk Engine Service

A high-performance NestJS microservice that monitors market price ticks and detects when positions should be triggered (stop-loss, take-profit, or liquidation). This service is critical for the hot path and is optimized for sub-10ms latency per tick.
