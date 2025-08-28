import json
import mysql.connector
from transformers import pipeline
import logging
import os
import threading
import queue
from datetime import datetime

# Suppress symlinks warning
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_db_connection():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="Aastha1811",
            database="petrol_pump_finder"
        )
    except mysql.connector.Error as err:
        logging.error(f"Database connection failed: {err}")
        return None

def fetch_pump_and_reviews(pump_id):
    conn = get_db_connection()
    if not conn:
        return None, []
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Fetch pump details, including distance and address
        cursor.execute("""
            SELECT pump_id, name, latitude, longitude, distance, address
            FROM petrol_pumps WHERE pump_id = %s
        """, (str(pump_id),))
        pump = cursor.fetchone()
        
        if not pump:
            cursor.close()
            conn.close()
            return None, []
        
        # Fetch reviews for the specific pump
        cursor.execute("""
            SELECT reviewer_name, rating, review_text, review_date
            FROM reviews WHERE pump_id = %s
            ORDER BY review_date DESC
        """, (str(pump_id),))
        reviews = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return pump, reviews
    except mysql.connector.Error as err:
        logging.error(f"Error fetching data: {err}")
        return None, []
    finally:
        if conn.is_connected():
            conn.close()

def insert_review(pump_id, reviewer_name, rating, review_text):
    # Input validation
    if not isinstance(pump_id, str) or not pump_id.strip():
        return False, "Invalid pump ID."
    if not reviewer_name or len(reviewer_name.strip()) < 2:
        return False, "Reviewer name must be at least 2 characters."
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        return False, "Rating must be between 1 and 5."
    if not review_text or len(review_text.strip()) < 10:
        return False, "Review text must be at least 10 characters."

    conn = get_db_connection()
    if not conn:
        return False, "Database connection failed."
    
    try:
        cursor = conn.cursor()
        review_date = datetime.now()
        query = """
        INSERT INTO reviews (pump_id, reviewer_name, rating, review_text, review_date)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (pump_id.strip(), reviewer_name.strip(), rating, review_text.strip(), review_date))
        conn.commit()
        cursor.close()
        conn.close()
        return True, None
    except mysql.connector.Error as err:
        logging.error(f"Error inserting review: {err}")
        return False, str(err)
    finally:
        if conn.is_connected():
            conn.close()

# Global sentiment analyzer to avoid reloading
sentiment_analyzer = None

def initialize_sentiment_analyzer():
    global sentiment_analyzer
    if sentiment_analyzer is None:
        try:
            logging.info("Initializing sentiment analyzer...")
            sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                tokenizer="distilbert-base-uncased-finetuned-sst-2-english"
            )
            logging.info("Sentiment analyzer initialized successfully.")
        except Exception as e:
            logging.error(f"Failed to initialize sentiment analyzer: {e}")
            sentiment_analyzer = None

def analyze_single_review(text, result_queue, timeout=30):
    try:
        if not isinstance(text, str) or not text.strip():
            result_queue.put(None)
            return
        text = text[:512]  # Truncate to avoid token limit
        result = sentiment_analyzer(text)[0]
        result_queue.put(result['label'].lower())
    except Exception as e:
        logging.error(f"Error analyzing review: {e}")
        result_queue.put(None)

def analyze_sentiment(reviews):
    if not reviews:
        return {"positive": 0, "neutral": 0, "negative": 0}
    
    initialize_sentiment_analyzer()
    if sentiment_analyzer is None:
        logging.error("Sentiment analyzer not available.")
        return {"positive": 0, "neutral": 0, "negative": 0}
    
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    
    for review in reviews:
        text = review.get('review_text', '')
        result_queue = queue.Queue()
        thread = threading.Thread(target=analyze_single_review, args=(text, result_queue))
        thread.daemon = True
        thread.start()
        
        thread.join(timeout=30)  # 30-second timeout per review
        if thread.is_alive():
            logging.warning(f"Sentiment analysis timed out for review: {text[:50]}...")
            sentiment_counts["neutral"] += 1
            continue
        
        label = result_queue.get()
        if label == "positive":
            sentiment_counts["positive"] += 1
        elif label == "negative":
            sentiment_counts["negative"] += 1
        else:
            sentiment_counts["neutral"] += 1
    
    return sentiment_counts

def extract_topics(reviews):
    if not reviews:
        return []
    
    try:
        # Mock topic extraction (replace with actual NLP logic if needed)
        topics = [
            {"tag": "Fuel Quality", "percentage": 60, "sentiment": "positive"},
            {"tag": "Service Speed", "percentage": 40, "sentiment": "neutral"},
            
        ]
        return topics
    except Exception as e:
        logging.error(f"Topic extraction failed: {e}")
        return []

def generate_verdict(sentiment_counts):
    total = sentiment_counts["positive"] + sentiment_counts["neutral"] + sentiment_counts["negative"]
    if total == 0:
        return "No reviews available for verdict."
    
    positive_ratio = sentiment_counts["positive"] / total
    if positive_ratio > 0.7:
        return "Recommended"
    elif positive_ratio < 0.3:
        return "Not Recommended"
    else:
        return "Average"

def get_analysis_result(pump_id):
    try:
        pump, reviews = fetch_pump_and_reviews(pump_id)
        
        if not pump:
            result = {
                "pump": None,
                "reviews": [],
                "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
                "topics": [],
                "verdict": "Pump not found."
            }
        else:
            sentiment = analyze_sentiment(reviews)
            topics = extract_topics(reviews)
            verdict = generate_verdict(sentiment)
            
            result = {
                "pump": {
                    "pump_id": pump["pump_id"],
                    "name": pump["name"],
                    "latitude": float(pump["latitude"]),
                    "longitude": float(pump["longitude"]),
                    "distance": float(pump["distance"]) if pump["distance"] is not None else None,
                    "address": pump["address"]
                },
                "reviews": [
                    {
                        "reviewer_name": review["reviewer_name"],
                        "rating": review["rating"],
                        "review_text": review["review_text"],
                        "created_at": review["review_date"].isoformat()  # Use review_date
                    } for review in reviews
                ],
                "sentiment": sentiment,
                "topics": topics,
                "verdict": verdict
            }
        
        return result
    except Exception as e:
        logging.error(f"Analysis error: {e}")
        return {
            "pump": None,
            "reviews": [],
            "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
            "topics": [],
            "verdict": f"Error: {str(e)}"
        }

if __name__ == "__main__":
    import sys
    pump_id = sys.argv[1] if len(sys.argv) > 1 else None
    if not pump_id:
        print(json.dumps({
            "pump": None,
            "reviews": [],
            "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
            "topics": [],
            "verdict": "No pump_id provided."
        }))
    else:
        result = get_analysis_result(pump_id)
        print(json.dumps(result))