// Petrol Pump Details and Reviews
function initializeDetailsPage(pumpId) {
    // Handle star rating
    const stars = document.querySelectorAll(".star");
    let currentRating = 0;
  
    stars.forEach((star) => {
      star.addEventListener("click", function() {
        const rating = parseInt(this.getAttribute("data-rating"));
        currentRating = rating;
        updateStars(rating);
      });
  
      star.addEventListener("mouseover", function() {
        const rating = parseInt(this.getAttribute("data-rating"));
        updateStars(rating);
      });
  
      star.addEventListener("mouseout", function() {
        updateStars(currentRating);
      });
    });
  
    function updateStars(rating) {
      stars.forEach((s) => {
        const starRating = parseInt(s.getAttribute("data-rating"));
        if (starRating <= rating) {
          s.classList.add("active");
        } else {
          s.classList.remove("active");
        }
      });
    }
  
    // Load reviews from the server
    loadReviewsFromServer(pumpId);
  
    // Handle review form submission
    const reviewForm = document.getElementById("review-form");
    const reviewsContainer = document.getElementById("reviews-container");
    const noReviewsMessage = document.getElementById("no-reviews");
  
    reviewForm.addEventListener("submit", async function(e) {
      e.preventDefault();
  
      // Get form values
      const reviewerName = document.getElementById("reviewer-name").value;
      const reviewText = document.getElementById("review-text").value;
  
      // Validate form
      if (!reviewerName || !reviewText || currentRating === 0) {
        alert("Please fill in all fields and provide a rating.");
        return;
      }
  
      // Create new review
      const review = {
        pump_id: pumpId,
        reviewer_name: reviewerName,
        rating: currentRating,
        review_text: reviewText
      };
  
      try {
        // Save review to server
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(review),
        });
  
        const data = await response.json();
  
        if (data.success) {
          // Display the new review
          displayReview({
            ...review,
            review_date: new Date().toLocaleDateString()
          });
  
          // Hide the "no reviews" message
          noReviewsMessage.style.display = "none";
  
          // Reset form
          reviewForm.reset();
          currentRating = 0;
          updateStars(0);
  
          alert("Thank you for your review!");
  
          // Update sentiment analysis and topic extraction placeholders
          updateAnalysisSections(pumpId);
        } else {
          alert("Error saving review. Please try again.");
        }
      } catch (error) {
        console.error("Error saving review:", error);
        alert("Error saving review. Please try again.");
      }
    });
  
    // Function to load reviews from server
   // Function to load reviews from server
async function loadReviewsFromServer(pumpId) {
    if (!pumpId) {
      console.error("No pump ID provided");
      return;
    }
  
    try {
      console.log("Loading reviews for pump:", pumpId);
      const response = await fetch(`/api/reviews/${pumpId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
  
      if (data.success && data.reviews.length > 0) {
        noReviewsMessage.style.display = "none";
  
        // Display reviews
        data.reviews.forEach(review => {
          displayReview({
            name: review.reviewer_name,
            rating: review.rating,
            text: review.review_text,
            date: new Date(review.review_date).toLocaleDateString()
          });
        });
  
        // Update sentiment analysis and topic extraction placeholders
        updateAnalysisSections(pumpId, data.reviews.length);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      // Show error message to user
      noReviewsMessage.textContent = "Error loading reviews. Please refresh the page to try again.";
      noReviewsMessage.style.color = "#e74c3c";
    }
  }
  
    // Function to display a review
    function displayReview(review) {
      const reviewElement = document.createElement("div");
      reviewElement.classList.add("review");
  
      const reviewHeader = document.createElement("div");
      reviewHeader.classList.add("review-header");
  
      const nameElement = document.createElement("div");
      nameElement.classList.add("reviewer-name");
      nameElement.textContent = review.name || review.reviewer_name;
  
      const dateElement = document.createElement("div");
      dateElement.classList.add("review-date");
      dateElement.textContent = review.date;
  
      reviewHeader.appendChild(nameElement);
      reviewHeader.appendChild(dateElement);
  
      const ratingElement = document.createElement("div");
      ratingElement.classList.add("review-rating");
      ratingElement.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  
      const textElement = document.createElement("div");
      textElement.classList.add("review-text");
      textElement.textContent = review.text || review.review_text;
  
      reviewElement.appendChild(reviewHeader);
      reviewElement.appendChild(ratingElement);
      reviewElement.appendChild(textElement);
  
      // Add to the beginning of the container
      reviewsContainer.insertBefore(reviewElement, reviewsContainer.firstChild);
    }
  
    // Function to update analysis sections
    function updateAnalysisSections(pumpId, reviewCount) {
      // Get review count if not provided
      if (!reviewCount) {
        fetch(`/api/reviews/${pumpId}`)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              updateAnalysisContent(data.reviews.length);
            }
          })
          .catch(error => console.error("Error getting review count:", error));
      } else {
        updateAnalysisContent(reviewCount);
      }
  
      function updateAnalysisContent(count) {
        // Update sentiment analysis placeholder
        document.getElementById("sentiment-analysis").innerHTML = 
          "Review sentiment analysis will be added here. Currently analyzing " + 
          count + " reviews.";
        
        // Update topic extraction placeholder
        document.getElementById("topic-extraction").innerHTML = 
          "Topic extraction will be added here. Currently analyzing " + 
          count + " reviews.";
        
        // Update review summary placeholder
        document.getElementById("review-summary").innerHTML = 
          "Review summary will be added here. Currently analyzing " + 
          count + " reviews.";
      }
    }
  }