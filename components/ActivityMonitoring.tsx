"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  ipAddress: string;
  location: string;
  deviceInfo: string;
  timestamp: Date;
  status: 'normal' | 'suspicious' | 'blocked';
  details: string;
}

interface LoginAttempt {
  id: string;
  userId: string;
  userName: string;
  timestamp: Date;
  status: 'success' | 'failed';
  ipAddress: string;
  location: string;
  deviceInfo: string;
  failureReason?: string;
}

// Mock data generator
const generateMockData = () => {
  const activities: UserActivity[] = Array.from({ length: 10 }, (_, i) => ({
    id: `act-${i}`,
    userId: `user-${i}`,
    userName: `User ${i}`,
    action: ['login', 'file_upload', 'profile_update', 'password_change'][i % 4],
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: ['New York', 'London', 'Tokyo', 'Sydney'][i % 4],
    deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][i % 3],
    timestamp: new Date(Date.now() - Math.random() * 86400000),
    status: ['normal', 'suspicious', 'normal', 'blocked'][i % 4] as 'normal' | 'suspicious' | 'blocked',
    details: 'User performed standard operation',
  }));

  const loginAttempts: LoginAttempt[] = Array.from({ length: 5 }, (_, i) => ({
    id: `login-${i}`,
    userId: `user-${i}`,
    userName: `User ${i}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000),
    status: i % 3 === 0 ? 'failed' : 'success',
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: ['New York', 'London', 'Tokyo', 'Sydney'][i % 4],
    deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][i % 3],
    failureReason: i % 3 === 0 ? 'Invalid credentials' : undefined,
  }));

  return { activities, loginAttempts };
};

export function ActivityMonitoring() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    // Initial load
    const { activities, loginAttempts } = generateMockData();
    setActivities(activities);
    setLoginAttempts(loginAttempts);

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (isMonitoring) {
        const newActivity: UserActivity = {
          id: `act-${Date.now()}`,
          userId: `user-${Math.floor(Math.random() * 10)}`,
          userName: `User ${Math.floor(Math.random() * 10)}`,
          action: ['login', 'file_upload', 'profile_update'][Math.floor(Math.random() * 3)],
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          location: ['New York', 'London', 'Tokyo'][Math.floor(Math.random() * 3)],
          deviceInfo: ['Chrome/Windows', 'Safari/MacOS', 'Firefox/Linux'][Math.floor(Math.random() * 3)],
          timestamp: new Date(),
          status: Math.random() > 0.8 ? 'suspicious' : 'normal',
          details: 'Real-time activity detected',
        };

        setActivities(prev => [newActivity, ...prev.slice(0, 9)]);

        // Show toast for suspicious activity
        if (newActivity.status === 'suspicious') {
          toast({
            title: "Suspicious Activity Detected",
            description: `User ${newActivity.userName} from ${newActivity.location}`,
            variant: "destructive",
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isMonitoring, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'suspicious':
        return <Badge variant="destructive">Suspicious</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'success':
        return <Badge variant="default">Success</Badge>;
      default:
        return <Badge>Normal</Badge>;
    }
  };

  const handleBlock = async (userId: string) => {
    toast({
      title: "User Blocked",
      description: `User ${userId} has been blocked`,
      variant: "default",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Activity Monitoring</h2>
        <Button 
          variant={isMonitoring ? "destructive" : "default"}
          onClick={() => setIsMonitoring(!isMonitoring)}
        >
          {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live User Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activity.userName}</span>
                    {getStatusBadge(activity.status)}
                  </div>
                  <span className="text-sm text-gray-500">
                    {activity.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">
                  {activity.action.replace('_', ' ')} • {activity.location}
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    IP: {activity.ipAddress} • {activity.deviceInfo}
                  </div>
                  {activity.status === 'suspicious' && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleBlock(activity.userId)}
                    >
                      Block User
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Login Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loginAttempts.map((attempt) => (
              <div key={attempt.id} className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{attempt.userName}</span>
                    {getStatusBadge(attempt.status)}
                  </div>
                  <span className="text-sm text-gray-500">
                    {attempt.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">
                  {attempt.location} • {attempt.deviceInfo}
                </p>
                <div className="text-xs text-gray-400">
                  IP: {attempt.ipAddress}
                  {attempt.failureReason && (
                    <span className="text-red-500 ml-2">
                      Reason: {attempt.failureReason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 