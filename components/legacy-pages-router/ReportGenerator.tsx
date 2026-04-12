"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'user' | 'activity' | 'compliance' | 'security';
  frequency: 'one-time' | 'daily' | 'weekly' | 'monthly';
  lastGenerated?: Date;
}

interface Report {
  id: string;
  templateId: string;
  name: string;
  generatedAt: Date;
  status: 'completed' | 'failed' | 'in-progress';
  downloadUrl?: string;
}

interface ReportGeneratorProps {
  templates: ReportTemplate[];
  recentReports: Report[];
}

export function ReportGenerator({ templates, recentReports }: ReportGeneratorProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const generateReport = async () => {
    if (!selectedTemplate) return;
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Report Generation Started",
      description: "Your report will be ready in a few minutes",
      variant: "default",
    });
  };

  const downloadReport = async (report: Report) => {
    if (!report.downloadUrl) return;
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Download Started",
      description: "Your report download has started",
      variant: "default",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer ${
                    selectedTemplate === template.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge>{template.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{template.description}</p>
                  <div className="text-xs text-gray-400 flex items-center justify-between">
                    <span>Frequency: {template.frequency}</span>
                    {template.lastGenerated && (
                      <span>
                        Last generated: {new Date(template.lastGenerated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={generateReport}
              disabled={!selectedTemplate}
            >
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">{report.name}</p>
                  <p className="text-sm text-gray-500">
                    Generated: {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      report.status === 'completed'
                        ? 'default'
                        : report.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {report.status}
                  </Badge>
                  {report.status === 'completed' && report.downloadUrl && (
                    <Button 
                      variant="outline" 
                      onClick={() => downloadReport(report)}
                    >
                      Download
                    </Button>
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