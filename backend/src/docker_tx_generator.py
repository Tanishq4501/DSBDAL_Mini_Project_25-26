"""
Docker-friendly Kafka transaction generator.

Run this inside the Docker Compose stack to publish a continuous stream of
synthetic credit-card transactions into the fraud-transactions topic.
"""

import logging
import os
import time

try:
    from .kafka_producer import KafkaProducerClient, generate_transaction, _DEMO_FRAUD_RATE
except ImportError:
    from kafka_producer import KafkaProducerClient, generate_transaction, _DEMO_FRAUD_RATE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    topic = os.getenv("KAFKA_STREAM_TOPIC", "fraud-transactions")
    interval = float(os.getenv("TX_GENERATOR_INTERVAL", "0.5"))
    # Demo fraud rate — default 8 % so fraud is visible in the dashboard.
    # Set TX_GENERATOR_FRAUD_RATE=0.001727 to use the real Kaggle rate.
    fraud_rate = float(os.getenv("TX_GENERATOR_FRAUD_RATE", str(_DEMO_FRAUD_RATE)))
    logger.info(f"Generator config: topic={topic}, interval={interval}s, fraud_rate={fraud_rate:.1%}")

    while True:
        producer = KafkaProducerClient(bootstrap_servers=bootstrap_servers, topic=topic)
        if producer._producer is None:
            logger.warning("Kafka broker is not ready yet; retrying in 5 seconds.")
            time.sleep(5)
            continue

        logger.info("Kafka transaction generator started.")
        time_offset = 0.0

        try:
            while True:
                time_offset += 0.5
                tx = generate_transaction(time_offset=time_offset, fraud_rate=fraud_rate)
                if not producer.send_transaction(tx):
                    raise RuntimeError("Failed to publish transaction to Kafka")
                time.sleep(interval)
        except Exception as exc:
            logger.warning(f"Kafka stream stopped: {exc}. Reconnecting...")
        finally:
            producer.close()


if __name__ == "__main__":
    main()