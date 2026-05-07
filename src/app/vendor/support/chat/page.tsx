"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft, Send, MessageCircle, User, Bot, Clock, CheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  agentName?: string;
}

export default function SupportChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! Welcome to Reliance Support. I\'m Sarah, your support agent. How can I help you today?',
      sender: 'agent',
      timestamp: new Date(),
      agentName: 'Sarah'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatStatus, setChatStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Simulate connection
    const timer = setTimeout(() => {
      setChatStatus('connected');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || chatStatus !== 'connected') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate agent response
    setTimeout(() => {
      const responses = [
        'I understand your concern. Let me help you with that.',
        'That\'s a great question! Here\'s what you need to know...',
        'I can definitely help you resolve this issue.',
        'Let me check your account and get back to you with the details.',
        'I\'ll escalate this to our technical team for further investigation.'
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: randomResponse,
        sender: 'agent',
        timestamp: new Date(),
        agentName: 'Sarah'
      };

      setMessages(prev => [...prev, agentMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/vendor/support" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-4 h-4" />
                Back to Support
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Live Support Chat</h1>
          <p className="text-gray-600">Get instant help from our support team</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">Support Chat</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {chatStatus === 'connecting' && (
                          <>
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span>Connecting...</span>
                          </>
                        )}
                        {chatStatus === 'connected' && (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Connected with Sarah</span>
                          </>
                        )}
                        {chatStatus === 'disconnected' && (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span>Disconnected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTime(new Date())}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                        <div className={`rounded-lg px-4 py-2 ${
                          message.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{message.text}</p>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                          message.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          {message.sender === 'agent' && (
                            <>
                              <User className="w-3 h-3" />
                              <span>{message.agentName}</span>
                            </>
                          )}
                          <span>{formatTime(message.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-1">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm text-gray-600 ml-2">Sarah is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      disabled={chatStatus !== 'connected'}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || chatStatus !== 'connected'}
                      size="icon"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Info Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chat Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Sarah Johnson</h3>
                    <p className="text-sm text-gray-600">Support Agent</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Online</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>Response time: ~2 min</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📋 View Ticket History
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📧 Email Transcript
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  ⭐ Rate Chat
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Helpful Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/vendor/support/faqs" className="block text-sm text-blue-600 hover:underline">
                  📖 FAQs
                </Link>
                <Link href="/vendor/support/help-articles" className="block text-sm text-blue-600 hover:underline">
                  📚 Help Articles
                </Link>
                <Link href="/vendor/support/contact" className="block text-sm text-blue-600 hover:underline">
                  📧 Submit Ticket
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 