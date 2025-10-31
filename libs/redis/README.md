# libs/redis

Connection helper and key builders for triggers and current prices.

Keys:
- current-price:{symbol}
- triggers:{symbol}:{side}:{type} (ZSET)
