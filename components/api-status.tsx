"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react"

interface ApiKeyStatus {
  index: number
  status: 'active' | 'failed' | 'unknown'
  lastUsed?: Date
  error?: string
}

export default function ApiStatus() {
  const [apiStatuses, setApiStatuses] = useState<ApiKeyStatus[]>([
    { index: 1, status: 'unknown' },
    { index: 2, status: 'unknown' },
    { index: 3, status: 'unknown' },
    { index: 4, status: 'unknown' },
  ])
  
  const [currentActiveKey, setCurrentActiveKey] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Listen for API key usage events from console logs
    const originalConsoleLog = console.log
    const originalConsoleWarn = console.warn
    
    console.log = (...args) => {
      const message = args.join(' ')
      
      // Detect successful API key usage
      if (message.includes('✅ Successfully used API key')) {
        const match = message.match(/API key (\d+)/)
        if (match) {
          const keyIndex = parseInt(match[1])
          setCurrentActiveKey(keyIndex)
          setApiStatuses(prev => 
            prev.map(status => 
              status.index === keyIndex 
                ? { ...status, status: 'active' as const, lastUsed: new Date() }
                : status
            )
          )
        }
      }
      
      // Detect API key failures
      if (message.includes('⚠️ Retryable error with API key')) {
        const match = message.match(/API key (\d+)/)
        if (match) {
          const keyIndex = parseInt(match[1])
          setApiStatuses(prev => 
            prev.map(status => 
              status.index === keyIndex 
                ? { ...status, status: 'failed' as const, error: 'Rate limit or quota exceeded' }
                : status
            )
          )
        }
      }
      
      originalConsoleLog.apply(console, args)
    }
    
    console.warn = (...args) => {
      const message = args.join(' ')
      
      // Detect API key failures
      if (message.includes('API key') && message.includes('failed')) {
        const match = message.match(/API key (\d+)/)
        if (match) {
          const keyIndex = parseInt(match[1])
          setApiStatuses(prev => 
            prev.map(status => 
              status.index === keyIndex 
                ? { ...status, status: 'failed' as const, error: 'API request failed' }
                : status
            )
          )
        }
      }
      
      originalConsoleWarn.apply(console, args)
    }
    
    return () => {
      console.log = originalConsoleLog
      console.warn = originalConsoleWarn
    }
  }, [])

  const getStatusIcon = (status: ApiKeyStatus['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: ApiKeyStatus['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-400/30'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-400/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-400/30'
    }
  }

  const hasFailures = apiStatuses.some(status => status.status === 'failed')
  const activeKeys = apiStatuses.filter(status => status.status === 'active').length

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div
          className="p-2 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 cursor-pointer hover:bg-black/30 transition-colors"
          onClick={() => setIsVisible(!isVisible)}
        >
          {hasFailures ? (
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-400" />
          )}
        </div>

        {/* Detailed Status Panel */}
        {isVisible && (
          <Card className="w-80 bg-black/20 backdrop-blur-xl border border-white/10 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                API Key Status
                {currentActiveKey && (
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                    Using Key {currentActiveKey}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-white/60">Active Keys:</div>
                <div className="text-green-400">{activeKeys}/4</div>
                <div className="text-white/60">Failed Keys:</div>
                <div className="text-red-400">{apiStatuses.filter(s => s.status === 'failed').length}/4</div>
              </div>
              
              <div className="space-y-2">
                {apiStatuses.map((status) => (
                  <div
                    key={status.index}
                    className={`p-2 rounded-lg border flex items-center justify-between ${getStatusColor(status.status)}`}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.status)}
                      <span className="font-medium">Key {status.index}</span>
                      {status.index === currentActiveKey && (
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    {status.lastUsed && (
                      <span className="text-xs opacity-70">
                        {status.lastUsed.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {hasFailures && (
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400">
                    Some API keys are experiencing issues. Automatic fallback is active.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}