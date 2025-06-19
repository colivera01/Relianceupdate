"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: Date;
  ip: string;
}

interface SecuritySettingsProps {
  is2FAEnabled: boolean;
  sessions: Session[];
  whitelistedIPs: string[];
}

export function SecuritySettings({ is2FAEnabled, sessions, whitelistedIPs }: SecuritySettingsProps) {
  const { toast } = useToast();
  const [newIP, setNewIP] = useState("");
  
  const toggle2FA = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: is2FAEnabled ? "2FA Disabled" : "2FA Enabled",
      description: is2FAEnabled 
        ? "Two-factor authentication has been disabled" 
        : "Two-factor authentication has been enabled",
      variant: is2FAEnabled ? "destructive" : "default",
    });
  };

  const terminateSession = async (sessionId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: "Session Terminated",
      description: "The selected session has been terminated",
      variant: "default",
    });
  };

  const addWhitelistedIP = async () => {
    if (!newIP) return;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: "IP Added",
      description: `${newIP} has been added to the whitelist`,
      variant: "default",
    });
    setNewIP("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Add an extra layer of security to your account
              </p>
              <Badge variant={is2FAEnabled ? "default" : "destructive"}>
                {is2FAEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <Button onClick={toggle2FA}>
              {is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">{session.device}</p>
                  <p className="text-sm text-gray-500">
                    {session.browser} • {session.location}
                  </p>
                  <p className="text-xs text-gray-400">
                    Last active: {new Date(session.lastActive).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">IP: {session.ip}</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => terminateSession(session.id)}
                >
                  Terminate
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IP Whitelist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter IP address"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
              />
              <Button onClick={addWhitelistedIP}>Add IP</Button>
            </div>
            <div className="space-y-2">
              {whitelistedIPs.map((ip) => (
                <div key={ip} className="flex items-center justify-between">
                  <code className="text-sm">{ip}</code>
                  <Button variant="ghost" size="sm">Remove</Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 