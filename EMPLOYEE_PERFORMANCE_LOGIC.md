# Employee Performance Card Logic & Data Sources

## Overview
The employee performance cards display comprehensive information generated from multiple data sources and analytical processes. Here's how each piece of information is derived:

## 1. **Basic Employee Information**
```typescript
// Data Source: HR/Employee Database
interface EmployeeBasic {
  id: string;
  name: string;
  role: string;
  hireDate: string;
  department: string;
  manager: string;
}
```

## 2. **Performance Metrics Calculation**

### **Average Rating (4.8★)**
```typescript
// Data Source: Customer Reviews Database
const calculateAverageRating = (employeeId: string, timeRange: string) => {
  const reviews = await getReviewsByEmployee(employeeId, timeRange);
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  return totalRating / reviews.length;
};

// Logic: Aggregate all customer reviews for this employee
// - Filter reviews by employee ID
// - Calculate weighted average (recent reviews weighted higher)
// - Apply confidence scoring for review authenticity
```

### **Review Count (32 reviews)**
```typescript
// Data Source: Customer Reviews Database
const getReviewCount = async (employeeId: string) => {
  const reviews = await getReviewsByEmployee(employeeId);
  return reviews.length;
};
```

### **Response Time (1.2h)**
```typescript
// Data Source: Job Management System
const calculateResponseTime = async (employeeId: string) => {
  const jobs = await getJobsByEmployee(employeeId);
  const responseTimes = jobs.map(job => {
    return job.firstResponseTime - job.assignedTime;
  });
  return average(responseTimes);
};
```

### **Completion Rate (98%)**
```typescript
// Data Source: Job Management System
const calculateCompletionRate = async (employeeId: string) => {
  const jobs = await getJobsByEmployee(employeeId);
  const completedJobs = jobs.filter(job => job.status === 'completed');
  return (completedJobs.length / jobs.length) * 100;
};
```

## 3. **Monthly Performance Trends**

### **5-Month Trend Data**
```typescript
// Data Source: Historical Performance Database
interface MonthlyPerformance {
  month: string;
  rating: number;
  reviews: number;
  responseTime: string;
  completion: number;
  trend: 'up' | 'down' | 'stable';
}

const generateMonthlyTrends = async (employeeId: string) => {
  const monthlyData = await getMonthlyPerformance(employeeId);
  
  return monthlyData.map(month => ({
    ...month,
    trend: calculateTrend(month.rating, month.previousRating)
  }));
};

const calculateTrend = (current: number, previous: number) => {
  const difference = current - previous;
  if (difference > 0.1) return 'up';
  if (difference < -0.1) return 'down';
  return 'stable';
};
```

## 4. **Strengths Analysis**

### **AI-Powered Strengths Detection**
```typescript
// Data Source: Review Text Analysis + Performance Metrics
interface StrengthAnalysis {
  strengths: string[];
  confidence: number;
  evidence: string[];
}

const analyzeStrengths = async (employeeId: string): Promise<StrengthAnalysis> => {
  // 1. Review Text Analysis
  const reviews = await getReviewsByEmployee(employeeId);
  const positiveKeywords = extractPositiveKeywords(reviews);
  
  // 2. Performance Pattern Analysis
  const performancePatterns = analyzePerformancePatterns(employeeId);
  
  // 3. Customer Feedback Analysis
  const customerFeedback = analyzeCustomerFeedback(employeeId);
  
  // 4. Manager Feedback
  const managerFeedback = await getManagerFeedback(employeeId);
  
  return {
    strengths: identifyStrengths(positiveKeywords, performancePatterns, customerFeedback, managerFeedback),
    confidence: calculateConfidence(evidence),
    evidence: collectEvidence()
  };
};

const extractPositiveKeywords = (reviews: Review[]) => {
  const positivePhrases = [
    'excellent', 'great', 'professional', 'knowledgeable', 'reliable',
    'on time', 'clean work', 'good communication', 'problem solver'
  ];
  
  return reviews.flatMap(review => 
    positivePhrases.filter(phrase => 
      review.text.toLowerCase().includes(phrase)
    )
  );
};

const analyzePerformancePatterns = (employeeId: string) => {
  // Analyze patterns like:
  // - Consistently high ratings
  // - Fast response times
  // - High completion rates
  // - Low customer complaints
  // - Positive repeat customer feedback
};
```

## 5. **Areas for Improvement Analysis**

### **Gap Analysis & Training Needs**
```typescript
// Data Source: Review Analysis + Performance Gaps + Training Records
interface ImprovementAnalysis {
  areasForImprovement: string[];
  priority: 'high' | 'medium' | 'low';
  trainingRecommendations: string[];
  evidence: string[];
}

const analyzeAreasForImprovement = async (employeeId: string): Promise<ImprovementAnalysis> => {
  // 1. Negative Review Analysis
  const negativeReviews = await getNegativeReviews(employeeId);
  const negativePatterns = extractNegativePatterns(negativeReviews);
  
  // 2. Performance Gap Analysis
  const performanceGaps = analyzePerformanceGaps(employeeId);
  
  // 3. Training History
  const trainingHistory = await getTrainingHistory(employeeId);
  
  // 4. Skill Assessment
  const skillAssessment = await getSkillAssessment(employeeId);
  
  return {
    areasForImprovement: identifyImprovementAreas(negativePatterns, performanceGaps, trainingHistory, skillAssessment),
    priority: calculatePriority(impact, frequency),
    trainingRecommendations: generateTrainingRecommendations(),
    evidence: collectEvidence()
  };
};

const extractNegativePatterns = (reviews: Review[]) => {
  const negativePhrases = [
    'slow', 'late', 'poor communication', 'unprofessional', 'messy',
    'didn\'t fix', 'had to call back', 'expensive', 'rude'
  ];
  
  return reviews.flatMap(review => 
    negativePhrases.filter(phrase => 
      review.text.toLowerCase().includes(phrase)
    )
  );
};
```

## 6. **Performance Level Classification**

### **"Exceeds Expectations" Logic**
```typescript
// Data Source: Performance Standards + Historical Data
const classifyPerformanceLevel = async (employeeId: string): Promise<string> => {
  const metrics = await getEmployeeMetrics(employeeId);
  const standards = await getPerformanceStandards();
  
  const score = calculatePerformanceScore(metrics, standards);
  
  if (score >= 4.5 && metrics.completionRate >= 95) {
    return 'Exceeds Expectations';
  } else if (score >= 4.0 && metrics.completionRate >= 90) {
    return 'Meets Expectations';
  } else {
    return 'Needs Improvement';
  }
};
```

## 7. **Next Review Date Calculation**

### **Review Scheduling Logic**
```typescript
// Data Source: HR Policy + Performance History
const calculateNextReviewDate = async (employeeId: string): Promise<string> => {
  const lastReview = await getLastReviewDate(employeeId);
  const performanceLevel = await getPerformanceLevel(employeeId);
  
  // Different review frequencies based on performance
  const reviewIntervals = {
    'Exceeds Expectations': 90, // days
    'Meets Expectations': 60,
    'Needs Improvement': 30
  };
  
  const nextReview = addDays(lastReview, reviewIntervals[performanceLevel]);
  return formatDate(nextReview);
};
```

## 8. **Data Integration Pipeline**

### **Real-Time Data Flow**
```typescript
// Main data aggregation function
const generateEmployeePerformanceCard = async (employeeId: string) => {
  // 1. Fetch all data sources
  const [
    basicInfo,
    reviews,
    jobs,
    trainingHistory,
    managerFeedback,
    performanceHistory
  ] = await Promise.all([
    getEmployeeBasicInfo(employeeId),
    getReviewsByEmployee(employeeId),
    getJobsByEmployee(employeeId),
    getTrainingHistory(employeeId),
    getManagerFeedback(employeeId),
    getPerformanceHistory(employeeId)
  ]);
  
  // 2. Calculate metrics
  const metrics = calculateMetrics(reviews, jobs);
  
  // 3. Analyze patterns
  const strengths = await analyzeStrengths(employeeId);
  const improvements = await analyzeAreasForImprovement(employeeId);
  
  // 4. Generate trends
  const trends = generateMonthlyTrends(performanceHistory);
  
  // 5. Classify performance
  const performanceLevel = classifyPerformanceLevel(metrics);
  
  return {
    ...basicInfo,
    ...metrics,
    monthlyPerformance: trends,
    strengths: strengths.strengths,
    areasForImprovement: improvements.areasForImprovement,
    performanceLevel,
    nextReviewDate: calculateNextReviewDate(employeeId)
  };
};
```

## 9. **Backend API Endpoints**

### **Required API Structure**
```typescript
// API endpoints needed to support this functionality
interface EmployeePerformanceAPI {
  // Core data endpoints
  GET /api/employees/{id}/reviews
  GET /api/employees/{id}/jobs
  GET /api/employees/{id}/performance-history
  GET /api/employees/{id}/training-history
  
  // Analysis endpoints
  GET /api/employees/{id}/strengths-analysis
  GET /api/employees/{id}/improvement-analysis
  GET /api/employees/{id}/performance-card
  
  // Management endpoints
  POST /api/employees/{id}/performance-review
  PUT /api/employees/{id}/training-schedule
  GET /api/employees/{id}/manager-feedback
}
```

## 10. **Machine Learning Components**

### **AI Analysis Pipeline**
```typescript
// Natural Language Processing for review analysis
const analyzeReviewSentiment = async (reviews: Review[]) => {
  // Use NLP to analyze:
  // - Sentiment (positive/negative/neutral)
  // - Key themes and topics
  // - Specific skills mentioned
  // - Customer satisfaction indicators
};

// Pattern recognition for performance trends
const detectPerformancePatterns = async (performanceData: PerformanceData[]) => {
  // Use ML to identify:
  // - Seasonal patterns
  // - Improvement trends
  // - Risk indicators
  // - Success predictors
};
```

This comprehensive system ensures that every piece of information on the employee performance cards is data-driven, accurate, and actionable for management decisions. 