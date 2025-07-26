'use client';
import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Upload, 
  X, 
  Save, 
  Calendar,
  DollarSign,
  Clock,
  Tag,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function VendorServicesPage() {
  const [services, setServices] = useState([
    {
      id: 1,
      name: 'Deep House Cleaning',
      category: 'Home Services',
      description: 'Professional deep cleaning service for your entire home. Our experienced team uses eco-friendly products and advanced cleaning techniques to ensure your home sparkles from top to bottom.',
      basePrice: 150,
      currentPrice: 120,
      discount: 20,
      duration: '3-4 hours',
      features: ['Eco-friendly products', 'Same day service available', 'Fully insured', 'Satisfaction guarantee', 'Professional equipment', 'Background checked staff'],
      inclusions: ['Deep cleaning of all rooms', 'Kitchen and bathroom sanitization', 'Floor and carpet cleaning', 'Window and mirror cleaning', 'Dusting and vacuuming', 'Eco-friendly cleaning products', 'Satisfaction guarantee'],
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop'
      ],
      videos: [
        'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4'
      ],
      isActive: true,
      createdAt: '2024-01-15'
    },
    {
      id: 2,
      name: 'Plumbing Repair',
      category: 'Home Services',
      description: 'Fast and reliable plumbing repair services for all your plumbing needs.',
      basePrice: 100,
      currentPrice: 85,
      discount: 15,
      duration: '1-2 hours',
      features: ['24/7 service', 'Emergency', 'Warranty', 'Licensed plumbers', 'Same day service'],
      inclusions: ['Diagnosis of issue', 'Repair work', 'Parts replacement', 'Testing', 'Cleanup', 'Warranty'],
      images: [
        'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop'
      ],
      videos: [
        'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4'
      ],
      isActive: true,
      createdAt: '2024-01-10'
    }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    basePrice: '',
    currentPrice: '',
    discount: '',
    duration: '',
    features: [''],
    inclusions: [''],
    images: [],
    videos: [],
    mediaType: 'all' // Filter for media display
  });

  const categories = [
    'Home Services',
    'Beauty & Wellness',
    'Technology',
    'Fitness',
    'Education',
    'Entertainment',
    'Pet Services',
    'Automotive'
  ];

  const handleCreateService = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      basePrice: '',
      currentPrice: '',
      discount: '',
      duration: '',
      features: [''],
      inclusions: [''],
      images: []
    });
    setEditingService(null);
    setShowCreateModal(true);
  };

  const handleEditService = (service) => {
    setFormData({
      name: service.name,
      category: service.category,
      description: service.description,
      basePrice: service.basePrice.toString(),
      currentPrice: service.currentPrice.toString(),
      discount: service.discount.toString(),
      duration: service.duration,
      features: [...service.features, ''],
      inclusions: [...service.inclusions, ''],
      images: service.images
    });
    setEditingService(service);
    setShowCreateModal(true);
  };

  const handleSaveService = () => {
    const newService = {
      id: editingService ? editingService.id : Date.now(),
      name: formData.name,
      category: formData.category,
      description: formData.description,
      basePrice: parseFloat(formData.basePrice),
      currentPrice: parseFloat(formData.currentPrice),
      discount: parseFloat(formData.discount),
      duration: formData.duration,
      features: formData.features.filter(f => f.trim()),
      inclusions: formData.inclusions.filter(i => i.trim()),
      images: formData.images,
      isActive: true,
      createdAt: editingService ? editingService.createdAt : new Date().toISOString().split('T')[0]
    };

    if (editingService) {
      setServices(services.map(s => s.id === editingService.id ? newService : s));
    } else {
      setServices([...services, newService]);
    }

    setShowCreateModal(false);
    setEditingService(null);
  };

  const handleDeleteService = (serviceId) => {
    setServices(services.filter(s => s.id !== serviceId));
  };

  const handleToggleActive = (serviceId) => {
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, isActive: !s.isActive } : s
    ));
  };

  const handleAddFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const handleRemoveFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateFeature = (index, value) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f)
    }));
  };

  const handleAddInclusion = () => {
    setFormData(prev => ({
      ...prev,
      inclusions: [...prev.inclusions, '']
    }));
  };

  const handleRemoveInclusion = (index) => {
    setFormData(prev => ({
      ...prev,
      inclusions: prev.inclusions.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateInclusion = (index, value) => {
    setFormData(prev => ({
      ...prev,
      inclusions: prev.inclusions.map((i, idx) => idx === index ? value : i)
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const imageUrls = files.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...imageUrls]
    }));
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    const videoUrls = files.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      videos: [...prev.videos, ...videoUrls]
    }));
  };

  const handleRemoveVideo = (index) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index)
    }));
  };

  const handleMediaTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      mediaType: type
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Service Management</h1>
            <p className="text-gray-600">Create and manage your services</p>
          </div>
          <button
            onClick={handleCreateService}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Create Service
          </button>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Service Image */}
              <div className="relative h-48">
                <img 
                  src={service.images[0] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop'} 
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handleToggleActive(service.id)}
                    className={`p-1 rounded-full ${
                      service.isActive 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    {service.isActive ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </button>
                </div>
                {service.discount > 0 && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    {service.discount}% OFF
                  </div>
                )}
              </div>

              {/* Service Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600">{service.category}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600">${service.currentPrice}</div>
                    {service.discount > 0 && (
                      <div className="text-sm text-gray-500 line-through">${service.basePrice}</div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-3 line-clamp-2">{service.description}</p>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{service.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    <span>{service.features.length} features</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    <span>{service.images.length + service.videos.length} media</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditService(service)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingService ? 'Edit Service' : 'Create New Service'}
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Enter service name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select category</option>
                            {categories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Describe your service in detail"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                          <input
                            type="text"
                            value={formData.duration}
                            onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g., 2-3 hours"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Base Price ($)</label>
                          <input
                            type="number"
                            value={formData.basePrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Current Price ($)</label>
                          <input
                            type="number"
                            value={formData.currentPrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                          <input
                            type="number"
                            value={formData.discount}
                            onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Features */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
                      <div className="space-y-2">
                        {formData.features.map((feature, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={feature}
                              onChange={(e) => handleUpdateFeature(index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Enter feature"
                            />
                            <button
                              onClick={() => handleRemoveFeature(index)}
                              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={handleAddFeature}
                          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors"
                        >
                          + Add Feature
                        </button>
                      </div>
                    </div>

                    {/* What's Included */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Included</h3>
                      <div className="space-y-2">
                        {formData.inclusions.map((inclusion, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={inclusion}
                              onChange={(e) => handleUpdateInclusion(index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Enter inclusion"
                            />
                            <button
                              onClick={() => handleRemoveInclusion(index)}
                              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={handleAddInclusion}
                          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors"
                        >
                          + Add Inclusion
                        </button>
                      </div>
                    </div>

                    {/* Images */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Images</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {formData.images.map((image, index) => (
                            <div key={index} className="relative">
                              <img 
                                src={image} 
                                alt={`Service ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Images</label>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveService}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                  >
                    <Save className="w-4 h-4" />
                    {editingService ? 'Update Service' : 'Create Service'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 