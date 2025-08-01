'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Shield, 
  ArrowLeft, 
  CheckCircle, 
  Mail, 
  Lock, 
  User as UserIcon,
  Building,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  AlertCircle,
  Info,
  X
} from 'lucide-react';

// reCAPTCHA Configuration - Update this single location if site key changes
const RECAPTCHA_SITE_KEY = '6LdAapYrAAAAAACfyJlrW40cSZBS7mm_W8r3Mjkiw';

// US States list for dropdown selection
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Declare grecaptcha type for TypeScript
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userType, setUserType] = useState<'user' | 'vendor'>('user');
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
    meetsRequirements: false
  });
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<string>('');

  const [formData, setFormData] = useState({
    // Basic Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    bio: '',
    
    // Vendor specific fields
    businessName: '',
    businessType: '',
    category: '',
    foundedYear: '',
    licenseNumber: '',
    insuranceStatus: false,
    bondingStatus: false,
    totalEmployees: '',
    yearsInBusiness: '',
    serviceTypes: [] as string[],
    specializations: [] as string[],
    serviceAreas: [] as string[],
    website: '',
    emergencyContact: '',
    responseTimeSettings: ''
  });

  // Service type options for vendors
  const serviceTypeOptions = [
    'House Cleaning', 'Deep Cleaning', 'Move-in/Move-out Cleaning', 'Commercial Cleaning',
    'Carpet Cleaning', 'Window Cleaning', 'Kitchen Deep Clean', 'Bathroom Deep Clean',
    'Laundry Services', 'Pet-friendly Cleaning', 'Eco-friendly Cleaning', 'Post-Construction Cleaning',
    'Regular Maintenance', 'One-time Cleaning', 'Emergency Cleaning', 'Automotive Services',
    'Home Services', 'Technology Services', 'Design Services', 'Health Services'
  ];

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'vendor' || type === 'user') {
      setUserType(type);
    }
  }, [searchParams]);

  // Load reCAPTCHA script dynamically
  useEffect(() => {
    const loadRecaptcha = () => {
      if (!window.grecaptcha) {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    };

    loadRecaptcha();
  }, []);

  // Generate reCAPTCHA token
  const generateRecaptchaToken = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }

      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' })
          .then((token: string) => {
            resolve(token);
          })
          .catch((error: any) => {
            reject(error);
          });
      });
    });
  };

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = [];
    
    if (password.length >= 8) score++;
    else feedback.push('At least 8 characters');
    
    if (/[a-z]/.test(password)) score++;
    else feedback.push('At least one lowercase letter');
    
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('At least one uppercase letter');
    
    if (/[0-9]/.test(password)) score++;
    else feedback.push('At least one number');
    
    if (/[^A-Za-z0-9]/.test(password)) score++;
    else feedback.push('At least one special character');
    
    const meetsRequirements = score >= 4;
    
    setPasswordStrength({
      score,
      feedback: feedback.join(', '),
      meetsRequirements
    });
  };

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // Check password strength
    if (field === 'password') {
      checkPasswordStrength(value as string);
    }
  };

  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {};

    // Required field validation
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address (e.g., user@example.com)';
    
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number (e.g., 555-123-4567)';
    }

    if (!formData.password) newErrors.password = 'Password is required';
    else if (!passwordStrength.meetsRequirements) {
      newErrors.password = `Password must meet all requirements: ${passwordStrength.feedback}`;
    }

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match. Please make sure both passwords are identical.';
    }

    // Address validation
    if (!formData.address.trim()) newErrors.address = 'Street address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'Please select your state';
    if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
    else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (userType === 'user') return true; // User step 2 is just review

    const newErrors: {[key: string]: string} = {};

    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.businessType.trim()) newErrors.businessType = 'Business type is required (e.g., LLC, Corporation, Individual)';
    if (!formData.category.trim()) newErrors.category = 'Primary service category is required (e.g., Cleaning, Plumbing, Design)';
    
    if (!formData.foundedYear) newErrors.foundedYear = 'Founded year is required';
    else {
      const currentYear = new Date().getFullYear();
      const foundedYear = parseInt(formData.foundedYear);
      if (foundedYear < 1900 || foundedYear > currentYear) {
        newErrors.foundedYear = `Founded year must be between 1900 and ${currentYear}`;
      }
    }
    
    if (!formData.totalEmployees) newErrors.totalEmployees = 'Number of employees is required';
    else {
      const employees = parseInt(formData.totalEmployees);
      if (employees < 1) newErrors.totalEmployees = 'Number of employees must be at least 1';
    }
    
    if (!formData.yearsInBusiness) newErrors.yearsInBusiness = 'Years in business is required';
    else {
      const years = parseInt(formData.yearsInBusiness);
      if (years < 0 || years > 100) newErrors.yearsInBusiness = 'Years in business must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(''); // Clear any previous errors
    setSubmitSuccess(''); // Clear any previous success messages

    try {
      // Generate reCAPTCHA token before form submission
      const token = await generateRecaptchaToken();
      setRecaptchaToken(token);

      // Prepare registration data with reCAPTCHA token
      const registrationData = {
        ...formData,
        userType,
        recaptchaToken: token // Include reCAPTCHA token for backend verification
      };

      // Determine the correct API endpoint based on user type
      const apiEndpoint = userType === 'vendor' ? '/api/vendor/register' : '/api/customer/register';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok) {
        // Clear any existing errors
        setErrors({});
        setSubmitError('');
        setSubmitSuccess('Account created successfully! Redirecting...');
        
        // Show success message briefly before redirecting
        setTimeout(() => {
          if (userType === 'vendor') {
            router.push('/vendor/secure-account');
          } else {
            router.push('/customer/secure-account');
          }
        }, 1500);
      } else {
        // Handle different types of errors
        if (response.status === 400) {
          // Validation errors from backend
          if (data.error) {
            setSubmitError(data.error);
          } else {
            setSubmitError('Please check your information and try again.');
          }
        } else if (response.status === 429) {
          setSubmitError('Too many registration attempts. Please wait a moment and try again.');
        } else if (response.status === 500) {
          setSubmitError('Server error. Please try again later.');
        } else {
          setSubmitError(data.error || 'Registration failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle different types of network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setSubmitError('Network error. Please check your internet connection and try again.');
      } else if (error instanceof Error && error.message.includes('reCAPTCHA')) {
        setSubmitError('reCAPTCHA verification failed. Please refresh the page and try again.');
      } else {
        setSubmitError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const userBenefits = [
    "Browse local professionals in your area",
    "Read authentic customer reviews",
    "View vendor video profiles",
    "Contact vendors directly",
    "Save your favorite professionals"
  ];

  const vendorBenefits = [
    "Create your professional profile",
    "Showcase your services with video",
    "Get discovered by local customers",
    "Build your online reputation",
    "Access customer reviews and feedback"
  ];

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score >= 4) return 'text-green-600';
    if (passwordStrength.score >= 3) return 'text-yellow-600';
    if (passwordStrength.score >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join Reliance
          </h1>
          <p className="text-gray-600">
            Create your account and start your journey
          </p>
        </div>

        {/* User Type Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setUserType('user')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                userType === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserIcon className="inline h-4 w-4 mr-2" />
              I Need Services
            </button>
            <button
              onClick={() => setUserType('vendor')}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                userType === 'vendor'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Shield className="inline h-4 w-4 mr-2" />
              I Provide Services
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Registration Form */}
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  userType === 'user' ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                  {userType === 'user' ? (
                    <UserIcon className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Shield className="h-5 w-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {userType === 'user' ? 'Customer Registration' : 'Vendor Registration'}
                  </CardTitle>
                  <CardDescription>
                    {userType === 'user' ? 'Join to find services' : 'Join to provide services'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
                             <form onSubmit={handleSubmit} className="space-y-4">
                 {/* Hidden reCAPTCHA token field */}
                 <input 
                   type="hidden" 
                   name="recaptchaToken" 
                   value={recaptchaToken} 
                 />

                 {/* Submit Error Display */}
                 {submitError && (
                   <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                     <div className="flex items-center">
                       <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                       <div>
                         <h4 className="text-sm font-medium text-red-800">Registration Error</h4>
                         <p className="text-sm text-red-700 mt-1">{submitError}</p>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Submit Success Display */}
                 {submitSuccess && (
                   <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                     <div className="flex items-center">
                       <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                       <div>
                         <h4 className="text-sm font-medium text-green-800">Success!</h4>
                         <p className="text-sm text-green-700 mt-1">{submitSuccess}</p>
                       </div>
                     </div>
                   </div>
                 )}

                {/* Step 1: Basic Information */}
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className={errors.firstName ? 'border-red-500' : ''}
                          required
                        />
                        {errors.firstName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className={errors.lastName ? 'border-red-500' : ''}
                          required
                        />
                        {errors.lastName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={errors.email ? 'border-red-500' : ''}
                        required
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={errors.phone ? 'border-red-500' : ''}
                        placeholder="(555) 123-4567"
                        required
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    {/* Address Fields */}
                    <div>
                      <Label htmlFor="address">Address *</Label>
                      <Input
                        id="address"
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className={errors.address ? 'border-red-500' : ''}
                        placeholder="123 Main St"
                        required
                      />
                      {errors.address && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.address}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className={errors.city ? 'border-red-500' : ''}
                          required
                        />
                        {errors.city && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.city}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Select
                          value={formData.state}
                          onValueChange={(value) => handleInputChange('state', value)}
                        >
                          <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select a state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.state && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.state}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="zipCode">ZIP Code *</Label>
                        <Input
                          id="zipCode"
                          type="text"
                          value={formData.zipCode}
                          onChange={(e) => handleInputChange('zipCode', e.target.value)}
                          className={errors.zipCode ? 'border-red-500' : ''}
                          required
                        />
                        {errors.zipCode && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.zipCode}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio for both users and vendors */}
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={userType === 'user' ? 
                          "Tell us about yourself and what services you're looking for..." : 
                          "Tell customers about your business, experience, and what makes you unique..."
                        }
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.password}
                        </p>
                      )}
                      {/* Password strength indicator */}
                      {formData.password && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">Password Strength:</span>
                            <span className={`text-sm font-medium ${getPasswordStrengthColor()}`}>
                              {passwordStrength.score >= 4 ? 'Strong' : 
                               passwordStrength.score >= 3 ? 'Good' : 
                               passwordStrength.score >= 2 ? 'Fair' : 'Weak'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                passwordStrength.score >= 4 ? 'bg-green-500' :
                                passwordStrength.score >= 3 ? 'bg-yellow-500' :
                                passwordStrength.score >= 2 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{width: `${(passwordStrength.score / 5) * 100}%`}}
                            ></div>
                          </div>
                          {passwordStrength.feedback && (
                            <p className="text-xs text-gray-600 mt-1">
                              Requirements: {passwordStrength.feedback}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                    
                    <Button 
                      type="button" 
                      onClick={handleNextStep} 
                      className="w-full"
                      disabled={!formData.firstName || !formData.lastName || !formData.email || 
                               !formData.password || !formData.confirmPassword || !passwordStrength.meetsRequirements}
                    >
                      Next Step
                    </Button>
                  </>
                )}

                {/* Step 2: Business Information (Vendor only) */}
                {step === 2 && userType === 'vendor' && (
                  <>
                    <div>
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input
                        id="businessName"
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange('businessName', e.target.value)}
                        className={errors.businessName ? 'border-red-500' : ''}
                        required
                      />
                      {errors.businessName && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.businessName}
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="businessType">Business Type *</Label>
                        <Input
                          id="businessType"
                          type="text"
                          value={formData.businessType}
                          onChange={(e) => handleInputChange('businessType', e.target.value)}
                          className={errors.businessType ? 'border-red-500' : ''}
                          placeholder="e.g., Individual, LLC, Corporation"
                          required
                        />
                        {errors.businessType && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.businessType}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="category">Primary Service Category *</Label>
                        <Input
                          id="category"
                          type="text"
                          value={formData.category}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                          className={errors.category ? 'border-red-500' : ''}
                          placeholder="e.g., Cleaning, Plumbing, Design"
                          required
                        />
                        {errors.category && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.category}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Service Types */}
                    <div>
                      <Label>Service Types Offered</Label>
                      <p className="text-sm text-gray-600 mb-3">Select all the services your business provides</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {serviceTypeOptions.map((serviceType) => (
                          <div key={serviceType} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={serviceType}
                              checked={formData.serviceTypes.includes(serviceType)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleInputChange('serviceTypes', [...formData.serviceTypes, serviceType]);
                                } else {
                                  handleInputChange('serviceTypes', formData.serviceTypes.filter(type => type !== serviceType));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={serviceType} className="text-sm text-gray-700 cursor-pointer">
                              {serviceType}
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Selected: {formData.serviceTypes.length} service types</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="foundedYear">Founded Year *</Label>
                        <Input
                          id="foundedYear"
                          type="number"
                          value={formData.foundedYear}
                          onChange={(e) => handleInputChange('foundedYear', e.target.value)}
                          className={errors.foundedYear ? 'border-red-500' : ''}
                          min="1900"
                          max={new Date().getFullYear()}
                          required
                        />
                        {errors.foundedYear && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.foundedYear}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="totalEmployees">Total Employees *</Label>
                        <Input
                          id="totalEmployees"
                          type="number"
                          value={formData.totalEmployees}
                          onChange={(e) => handleInputChange('totalEmployees', e.target.value)}
                          className={errors.totalEmployees ? 'border-red-500' : ''}
                          min="1"
                          required
                        />
                        {errors.totalEmployees && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.totalEmployees}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="yearsInBusiness">Years in Business *</Label>
                      <Input
                        id="yearsInBusiness"
                        type="number"
                        value={formData.yearsInBusiness}
                        onChange={(e) => handleInputChange('yearsInBusiness', e.target.value)}
                        className={errors.yearsInBusiness ? 'border-red-500' : ''}
                        min="0"
                        max="100"
                        required
                      />
                      {errors.yearsInBusiness && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.yearsInBusiness}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="licenseNumber">License Number</Label>
                      <Input
                        id="licenseNumber"
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                        placeholder="e.g., CLEAN-2019-001"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="insuranceStatus"
                          checked={formData.insuranceStatus}
                          onChange={(e) => handleInputChange('insuranceStatus', e.target.checked)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="insuranceStatus" className="text-sm font-medium text-gray-700">Insured</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="bondingStatus"
                          checked={formData.bondingStatus}
                          onChange={(e) => handleInputChange('bondingStatus', e.target.checked)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="bondingStatus" className="text-sm font-medium text-gray-700">Bonded</label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          type="url"
                          value={formData.website}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          placeholder="https://www.yourbusiness.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergencyContact">Emergency Contact</Label>
                        <Input
                          id="emergencyContact"
                          type="tel"
                          value={formData.emergencyContact}
                          onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                          placeholder="(555) 987-6543"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button 
                        type="button" 
                        onClick={() => setStep(1)} 
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                                             <Button 
                         type="submit" 
                         className="flex-1"
                         disabled={!formData.businessName || !formData.businessType || !formData.category ||
                                  !formData.foundedYear || !formData.totalEmployees || !formData.yearsInBusiness ||
                                  isSubmitting}
                       >
                         {isSubmitting ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                             Creating Account...
                           </div>
                         ) : (
                           'Create Account'
                         )}
                       </Button>
                    </div>
                  </>
                )}

                {/* Step 2: Final Step (User) */}
                {step === 2 && userType === 'user' && (
                  <>
                    <div className="text-center py-4">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Almost Done!</h3>
                      <p className="text-gray-600 mb-4">
                        Review your information and create your account.
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-2">Account Summary:</h4>
                      <p><strong>Name:</strong> {formData.firstName} {formData.lastName}</p>
                      <p><strong>Email:</strong> {formData.email}</p>
                      <p><strong>Phone:</strong> {formData.phone}</p>
                      <p><strong>Location:</strong> {formData.address}, {formData.city}, {formData.state} {formData.zipCode}</p>
                      {formData.bio && <p><strong>Bio:</strong> {formData.bio}</p>}
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        type="button" 
                        onClick={() => setStep(1)} 
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                                             <Button 
                         type="submit" 
                         className="flex-1"
                         disabled={isSubmitting}
                       >
                         {isSubmitting ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                             Creating Account...
                           </div>
                         ) : (
                           'Create Account'
                         )}
                       </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">
                Why Join Reliance?
              </CardTitle>
              <CardDescription>
                {userType === 'user' ? 'Benefits for customers' : 'Benefits for vendors'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(userType === 'user' ? userBenefits : vendorBenefits).map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Already have an account?</h4>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 