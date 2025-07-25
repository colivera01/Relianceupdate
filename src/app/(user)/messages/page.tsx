'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, 
  Search, 
  MoreVertical, 
  Paperclip, 
  Smile, 
  Phone, 
  Video,
  Circle,
  Check,
  CheckCheck,
  MessageSquare,
  Filter,
  Archive,
  Trash2,
  Star,
  Image as ImageIcon,
  File,
  Mic,
  X,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Settings,
  Volume2,
  VolumeX,
  Plus,
  Users,
  Mail,
  Phone as PhoneIcon,
  Copy,
  Flag,
  Shield,
  User,
  LogOut
} from 'lucide-react';

// Enhanced mock data
const mockConversations = [
  {
    id: '1',
    type: 'vendor',
    name: 'Elite Cleaning Services',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    lastMessage: 'Your booking has been confirmed for tomorrow at 2 PM',
    timestamp: '2 min ago',
    unreadCount: 1,
    isOnline: true,
    vendorId: 'vendor_123',
    isPinned: true,
    isArchived: false,
    lastActivity: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    type: 'support',
    name: 'Customer Support',
    avatar: '/reliance-logo.png',
    lastMessage: 'Thank you for your inquiry. We\'ll get back to you within 24 hours.',
    timestamp: '1 hour ago',
    unreadCount: 0,
    isOnline: true,
    vendorId: 'support',
    isPinned: false,
    isArchived: false,
    lastActivity: '2024-01-15T09:15:00Z'
  },
  {
    id: '3',
    type: 'vendor',
    name: 'Premium Landscaping',
    avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
    lastMessage: 'We\'ve completed the garden maintenance. Please review our work!',
    timestamp: '3 hours ago',
    unreadCount: 2,
    isOnline: false,
    vendorId: 'vendor_456',
    isPinned: false,
    isArchived: false,
    lastActivity: '2024-01-15T07:30:00Z'
  },
  {
    id: '4',
    type: 'system',
    name: 'Booking Confirmation',
    avatar: '/reliance-logo.png',
    lastMessage: 'Your booking with Elite Cleaning Services has been scheduled',
    timestamp: '1 day ago',
    unreadCount: 0,
    isOnline: false,
    vendorId: 'system',
    isPinned: false,
    isArchived: true,
    lastActivity: '2024-01-14T15:45:00Z'
  }
];

// Mock contacts for new message
const mockContacts = [
  { id: '1', name: 'John Smith', email: 'john@email.com', phone: '+1-555-0123', avatar: 'https://randomuser.me/api/portraits/men/1.jpg', type: 'client' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@email.com', phone: '+1-555-0124', avatar: 'https://randomuser.me/api/portraits/women/2.jpg', type: 'client' },
  { id: '3', name: 'Mike Wilson', email: 'mike@email.com', phone: '+1-555-0125', avatar: 'https://randomuser.me/api/portraits/men/3.jpg', type: 'vendor' },
  { id: '4', name: 'Lisa Brown', email: 'lisa@email.com', phone: '+1-555-0126', avatar: 'https://randomuser.me/api/portraits/women/4.jpg', type: 'vendor' },
];

const mockMessages = {
  '1': [
    {
      id: 'msg_1',
      sender: 'vendor',
      content: 'Hi! I\'m available for your cleaning service tomorrow.',
      timestamp: '10:30 AM',
      isRead: true,
      reactions: [],
      attachments: []
    },
    {
      id: 'msg_2',
      sender: 'user',
      content: 'Perfect! What time works best for you?',
      timestamp: '10:32 AM',
      isRead: true,
      reactions: [{ type: 'thumbsup', count: 1 }],
      attachments: []
    },
    {
      id: 'msg_3',
      sender: 'vendor',
      content: 'Your booking has been confirmed for tomorrow at 2 PM',
      timestamp: '10:35 AM',
      isRead: false,
      reactions: [],
      attachments: []
    }
  ],
  '2': [
    {
      id: 'msg_4',
      sender: 'user',
      content: 'I have a question about my recent booking',
      timestamp: '9:15 AM',
      isRead: true,
      reactions: [],
      attachments: []
    },
    {
      id: 'msg_5',
      sender: 'support',
      content: 'Thank you for your inquiry. We\'ll get back to you within 24 hours.',
      timestamp: '9:20 AM',
      isRead: true,
      reactions: [],
      attachments: []
    }
  ]
};

const reactionTypes = [
  { type: 'heart', icon: Heart, label: 'Love' },
  { type: 'thumbsup', icon: ThumbsUp, label: 'Like' },
  { type: 'thumbsdown', icon: ThumbsDown, label: 'Dislike' }
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
  const [isMuted, setIsMuted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isConversationSelectionMode, setIsConversationSelectionMode] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Only auto-scroll if we're not loading a new conversation
    if (!isLoadingConversation) {
      scrollToBottom();
    }
  }, [messages, isLoadingConversation]);

  // Load conversations on component mount
  useEffect(() => {
    // TODO: Replace with actual API call
    // fetchConversations();
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      setIsLoadingConversation(true);
      const conversationMessages = mockMessages[selectedConversation as keyof typeof mockMessages] || [];
      setMessages(conversationMessages);
      // TODO: Mark messages as read
      // markMessagesAsRead(selectedConversation);
      
      // Reset loading state after a short delay to allow messages to render
      setTimeout(() => {
        setIsLoadingConversation(false);
      }, 100);
    }
  }, [selectedConversation]);

  // Debug logging
  useEffect(() => {
    console.log('Selection mode:', isSelectionMode);
    console.log('Selected messages:', Array.from(selectedMessages));
    console.log('Conversation selection mode:', isConversationSelectionMode);
    console.log('Selected conversations:', Array.from(selectedConversations));
  }, [isSelectionMode, selectedMessages, isConversationSelectionMode, selectedConversations]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.emoji-picker') && !target.closest('.chat-options')) {
        setShowEmojiPicker(false);
        setShowChatOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageData = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      reactions: [],
      attachments: []
    };

    // Optimistic update
    setMessages(prev => [...prev, messageData]);
    setNewMessage('');

    // TODO: Send to backend
    // await sendMessage(selectedConversation, newMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  const handleReaction = (messageId: string, reactionType: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions.find((r: any) => r.type === reactionType);
        if (existingReaction) {
          return {
            ...msg,
            reactions: msg.reactions.map((r: any) => 
              r.type === reactionType ? { ...r, count: r.count + 1 } : r
            )
          };
        } else {
          return {
            ...msg,
            reactions: [...msg.reactions, { type: reactionType, count: 1 }]
          };
        }
      }
      return msg;
    }));
  };

  const togglePinConversation = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, isPinned: !conv.isPinned } : conv
    ));
  };

  const archiveConversation = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, isArchived: true } : conv
    ));
  };

  const deleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    setShowMessageOptions(null);
  };

  const deleteSelectedMessages = () => {
    setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  const selectAllMessages = () => {
    if (selectedMessages.size === filteredMessages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(filteredMessages.map(msg => msg.id)));
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);
  };

  const exitSelectionMode = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  // Conversation selection functions
  const deleteSelectedConversations = () => {
    // Filter out selected conversations
    const newConversations = conversations.filter(conv => !selectedConversations.has(conv.id));
    // Update conversations state (in real app, this would be an API call)
    console.log('Deleting conversations:', Array.from(selectedConversations));
    setSelectedConversations(new Set());
    setIsConversationSelectionMode(false);
    // If current conversation is deleted, clear selection
    if (selectedConversation && selectedConversations.has(selectedConversation)) {
      setSelectedConversation(null);
    }
  };

  const selectAllConversations = () => {
    if (selectedConversations.size === filteredConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(filteredConversations.map(conv => conv.id)));
    }
  };

  const toggleConversationSelection = (conversationId: string) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const exitConversationSelectionMode = () => {
    setSelectedConversations(new Set());
    setIsConversationSelectionMode(false);
  };

  // Chat header controls
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    console.log('Conversation muted:', !isMuted);
    // TODO: API call to mute/unmute conversation
  };

  const handleAudioCall = () => {
    console.log('Initiating audio call with:', selectedConv?.name);
    // TODO: Implement audio call functionality
    alert('Audio call feature coming soon!');
  };

  const handleVideoCall = () => {
    console.log('Initiating video call with:', selectedConv?.name);
    // TODO: Implement video call functionality
    alert('Video call feature coming soon!');
  };

  const handleViewProfile = () => {
    console.log('Viewing profile for:', selectedConv?.name);
    // TODO: Navigate to profile page
    alert('Profile view feature coming soon!');
  };

  const handleCopyChatLink = () => {
    const chatLink = `${window.location.origin}/messages/${selectedConversation}`;
    navigator.clipboard.writeText(chatLink);
    console.log('Chat link copied:', chatLink);
    setShowChatOptions(false);
  };

  const handleReportConversation = () => {
    console.log('Reporting conversation:', selectedConversation);
    // TODO: Open report modal
    alert('Report feature coming soon!');
    setShowChatOptions(false);
  };

  const handleBlockContact = () => {
    if (confirm(`Are you sure you want to block ${selectedConv?.name}?`)) {
      console.log('Blocking contact:', selectedConv?.name);
      // TODO: API call to block contact
      alert('Contact blocked successfully!');
      setShowChatOptions(false);
    }
  };

  // Message reactions
  const handleMessageReaction = (messageId: string, reactionType: string) => {
    setMessageReactions(prev => {
      const currentReactions = prev[messageId] || [];
      const newReactions = currentReactions.includes(reactionType) 
        ? currentReactions.filter(r => r !== reactionType)
        : [...currentReactions, reactionType];
      
      return {
        ...prev,
        [messageId]: newReactions
      };
    });
    console.log('Added reaction:', reactionType, 'to message:', messageId);
  };

  // File upload and attachments
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('Files selected for upload:', files);
      // TODO: Implement file upload logic
      alert(`Selected ${files.length} file(s) for upload!`);
      setShowFileUpload(false);
    }
  };

  const handleAttachmentMenu = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  // Voice recording
  const handleVoiceRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      console.log('Starting voice recording...');
      // TODO: Implement voice recording
      setTimeout(() => {
        setIsRecording(false);
        console.log('Voice recording completed');
        alert('Voice message recorded!');
      }, 3000); // Simulate 3-second recording
    }
  };

  // Emoji picker
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    setShowMessageOptions(null);
  };

  const startNewConversation = (contactId: string) => {
    const contact = mockContacts.find(c => c.id === contactId);
    if (contact) {
      // TODO: Create new conversation with contact
      console.log('Starting conversation with:', contact);
      setShowNewMessageModal(false);
      setSelectedContact(null);
      setContactSearchQuery('');
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || 
      (filterType === 'unread' && conv.unreadCount > 0) ||
      (filterType === 'pinned' && conv.isPinned) ||
      (filterType === 'archived' && conv.isArchived);
    return matchesSearch && matchesFilter;
  });

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
  );

  const filteredContacts = mockContacts.filter(contact =>
    contact.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(contactSearchQuery.toLowerCase())
  );

  const selectedConv = conversations.find(conv => conv.id === selectedConversation);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Conversations Sidebar */}
      <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <div className="flex items-center space-x-2">
              {isConversationSelectionMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllConversations}
                  >
                    {selectedConversations.size === filteredConversations.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedConversations}
                    disabled={selectedConversations.size === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete ({selectedConversations.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitConversationSelectionMode}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowNewMessageModal(true)}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsConversationSelectionMode(true)}
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Select
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Conversation Selection Mode Indicator */}
          {isConversationSelectionMode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trash2 className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800 font-medium">
                    Conversation Selection Mode - {selectedConversations.size} conversation{selectedConversations.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitConversationSelectionMode}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'All', count: conversations.length },
              { key: 'unread', label: 'Unread', count: conversations.filter(c => c.unreadCount > 0).length },
              { key: 'pinned', label: 'Pinned', count: conversations.filter(c => c.isPinned).length },
              { key: 'archived', label: 'Archived', count: conversations.filter(c => c.isArchived).length }
            ].map(filter => (
              <Button
                key={filter.key}
                variant={filterType === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(filter.key as any)}
                className="flex-1 text-xs"
              >
                {filter.label}
                {filter.count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filter.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => !isConversationSelectionMode && setSelectedConversation(conversation.id)}
              className={`px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
              } ${conversation.isPinned ? 'bg-yellow-50' : ''} ${
                isConversationSelectionMode && selectedConversations.has(conversation.id) ? 'bg-blue-100 border-blue-300' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Conversation Selection Checkbox */}
                {isConversationSelectionMode && (
                  <div className="flex-shrink-0 mt-2">
                    <input
                      type="checkbox"
                      checked={selectedConversations.has(conversation.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleConversationSelection(conversation.id);
                      }}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                  </div>
                )}
                
                <div className="relative flex-shrink-0">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback>{conversation.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {conversation.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.name}
                      </h3>
                      {conversation.isPinned && (
                        <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {conversation.timestamp}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 truncate mb-2 pr-4">
                    {conversation.lastMessage}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinConversation(conversation.id);
                        }}
                        className="w-6 h-6 p-0 hover:bg-gray-200"
                      >
                        <Star className={`w-3 h-3 ${conversation.isPinned ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveConversation(conversation.id);
                        }}
                        className="w-6 h-6 p-0 hover:bg-gray-200"
                      >
                        <Archive className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                    
                    {conversation.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs ml-4 flex-shrink-0">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
                        {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={selectedConv?.avatar} />
                      <AvatarFallback>{selectedConv?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {selectedConv?.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedConv?.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedConv?.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isSelectionMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllMessages}
                      >
                        {selectedMessages.size === filteredMessages.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedMessages}
                        disabled={selectedMessages.size === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete ({selectedMessages.size})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={exitSelectionMode}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('Entering selection mode');
                          setIsSelectionMode(true);
                        }}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Select
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMuteToggle}
                        className={isMuted ? 'text-red-500' : ''}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleAudioCall}
                        className="hover:bg-green-100 hover:text-green-600"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleVideoCall}
                        className="hover:bg-blue-100 hover:text-blue-600"
                      >
                        <Video className="w-4 h-4" />
                      </Button>
                      <div className="relative">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowChatOptions(!showChatOptions)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                        
                        {/* Chat Options Menu */}
                        {showChatOptions && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px] chat-options">
                            <button 
                              onClick={handleViewProfile}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <User className="w-4 h-4" />
                              <span>View Profile</span>
                            </button>
                            <button 
                              onClick={handleCopyChatLink}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy Chat Link</span>
                            </button>
                            <button 
                              onClick={handleReportConversation}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Flag className="w-4 h-4" />
                              <span>Report</span>
                            </button>
                            <button 
                              onClick={handleBlockContact}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                            >
                              <Shield className="w-4 h-4" />
                              <span>Block</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Mode Indicator */}
            {isSelectionMode && (
              <div className="bg-yellow-50 border-b border-yellow-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800 font-medium">
                      Selection Mode - {selectedMessages.size} message{selectedMessages.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectionMode}
                    className="text-yellow-600 hover:text-yellow-800"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Message Search */}
            {messageSearchQuery && (
              <div className="bg-blue-50 border-b border-blue-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      Searching for "{messageSearchQuery}" - {filteredMessages.length} results
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMessageSearchQuery('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-xs lg:max-w-md relative group">
                    {/* Message Selection Checkbox */}
                    {isSelectionMode && (
                      <div className={`absolute ${message.sender === 'user' ? '-left-8' : '-right-8'} top-2 z-10`}>
                        <input
                          type="checkbox"
                          checked={selectedMessages.has(message.id)}
                          onChange={() => {
                            console.log('Toggling message selection:', message.id);
                            toggleMessageSelection(message.id);
                          }}
                          className="w-5 h-5 text-blue-600 bg-white border-2 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </div>
                    )}
                    
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      } ${isSelectionMode ? 'opacity-80' : ''}`}
                    >
                      <p className="text-sm">{message.content}</p>
                      
                      {/* Message Reactions */}
                      {message.reactions.length > 0 && (
                        <div className="flex items-center space-x-1 mt-2">
                          {message.reactions.map((reaction: any) => {
                            const reactionType = reactionTypes.find(r => r.type === reaction.type);
                            return reactionType ? (
                              <div
                                key={reaction.type}
                                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                                  message.sender === 'user' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-300 text-gray-700'
                                }`}
                              >
                                <reactionType.icon className="w-3 h-3" />
                                <span>{reaction.count}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                      
                      <div className={`flex items-center justify-end mt-1 space-x-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span className="text-xs">{message.timestamp}</span>
                        {message.sender === 'user' && (
                          message.isRead ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
                    
                    {/* Message Actions */}
                    <div className={`flex items-center space-x-2 mt-1 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {reactionTypes.map(reaction => (
                        <Button
                          key={reaction.type}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(message.id, reaction.type)}
                          className="w-6 h-6 p-0 hover:bg-gray-100"
                        >
                          <reaction.icon className="w-3 h-3" />
                        </Button>
                      ))}
                      
                      {/* Message Options Button */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMessageOptions(showMessageOptions === message.id ? null : message.id)}
                          className="w-6 h-6 p-0 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                        
                        {/* Message Options Menu */}
                        {showMessageOptions === message.id && (
                          <div className={`absolute ${message.sender === 'user' ? 'right-0' : 'left-0'} top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]`}>
                            <button 
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              onClick={() => copyMessage(message.content)}
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </button>
                                                         <button 
                               className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                               onClick={() => copyMessage(message.content)}
                             >
                               <MessageSquare className="w-4 h-4" />
                               <span>Reply</span>
                             </button>
                            <button 
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                              onClick={() => deleteMessage(message.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  
                  {/* Attachment Menu */}
                  {showAttachmentMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center p-2"
                        >
                          <ImageIcon className="w-4 h-4 mb-1" />
                          <span className="text-xs">Photo</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center p-2"
                        >
                          <File className="w-4 h-4 mb-1" />
                          <span className="text-xs">File</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-12"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleVoiceRecording}
                  className={isRecording ? 'text-red-500 bg-red-50' : ''}
                >
                  <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 emoji-picker">
                  <div className="grid grid-cols-8 gap-1">
                    {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏'].map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State - Fixed Layout */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg w-full px-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Message</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewMessageModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Contacts
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or email..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => startNewConversation(contact.id)}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {contact.type}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">Or start a conversation with:</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="w-4 h-4 mr-2" />
                    Enter email address
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <PhoneIcon className="w-4 h-4 mr-2" />
                    Enter phone number
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Message Settings</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettingsModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Notifications</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">Message notifications</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">Sound alerts</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Desktop notifications</span>
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Privacy</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">Show online status</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Read receipts</span>
                  </label>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <Button variant="outline" className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Clear Chat History
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 