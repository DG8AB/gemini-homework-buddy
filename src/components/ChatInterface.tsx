import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Camera, X, Plus, Sparkles, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EmailComposer from './EmailComposer';
import ContactSelector from './ContactSelector';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  image?: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

const ChatInterface = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [emailComposer, setEmailComposer] = useState<{ isOpen: boolean; contacts: any[] }>({ isOpen: false, contacts: [] });
  const [contactSelector, setContactSelector] = useState<{ isOpen: boolean; contacts: any[]; position: { x: number; y: number } }>({ isOpen: false, contacts: [], position: { x: 0, y: 0 } });
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save to localStorage for guests, Supabase for logged in users
  const saveConversations = (convs: Conversation[]) => {
    localStorage.setItem('chat_conversations', JSON.stringify(convs));
  };

  // Load from localStorage for guests
  const loadConversations = (): Conversation[] => {
    try {
      const saved = localStorage.getItem('chat_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
      }
    } catch (error) {
      console.error('Error loading conversations from localStorage:', error);
    }
    return [];
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      // Load from Supabase for logged in users
      const loadFromSupabase = async () => {
        const { data, error } = await supabase
          .from('chat_histories')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const loadedConversations = data.map(record => ({
            id: record.conversation_id,
            title: record.title,
            messages: typeof record.messages === 'string' ? JSON.parse(record.messages) : record.messages,
            timestamp: new Date(record.updated_at)
          }));
          setConversations(loadedConversations);
          setActiveConversationId(loadedConversations[0].id);
        } else {
          createNewConversation();
        }
      };
      loadFromSupabase();
    } else {
      // Load from localStorage for guests
      const savedConversations = loadConversations();
      if (savedConversations.length > 0) {
        setConversations(savedConversations);
        setActiveConversationId(savedConversations[0].id);
      } else {
        createNewConversation();
      }
    }
  }, [user]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [{
        id: crypto.randomUUID(),
        role: 'ai',
        content: "Hi! I'm Helper, created by Dhruv Gowda. I'm here to help you with any questions or tasks you have. What can I assist you with today?",
        timestamp: new Date()
      }],
      timestamp: new Date()
    };

    const updatedConversations = [newConversation, ...conversations];
    setConversations(updatedConversations);
    setActiveConversationId(newConversation.id);
    
    // Save to localStorage for guests
    if (!user) {
      saveConversations(updatedConversations);
    }
  };

  const deleteConversation = (conversationId: string) => {
    const updatedConversations = conversations.filter(c => c.id !== conversationId);
    setConversations(updatedConversations);
    
    if (activeConversationId === conversationId) {
      if (updatedConversations.length > 0) {
        setActiveConversationId(updatedConversations[0].id);
      } else {
        createNewConversation();
        return;
      }
    }
    
    // Save to localStorage for guests, Supabase will auto-sync for logged in users
    if (!user) {
      saveConversations(updatedConversations);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Save conversations to database and localStorage
  useEffect(() => {
    const saveConversationsToSupabase = async () => {
      if (conversations.length > 0 && user) {
        try {
          // Use Promise.all to properly handle async operations
          await Promise.all(
            conversations.map(async (conv) => {
              const { error } = await supabase
                .from('chat_histories')
                .upsert({
                  user_id: user.id,
                  conversation_id: conv.id,
                  title: conv.title,
                  messages: JSON.stringify(conv.messages),
                }, { 
                  onConflict: 'conversation_id'
                });
              
              if (error) {
                console.error('Error saving conversation to Supabase:', error);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to save conversation to cloud storage",
                });
              }
            })
          );
        } catch (error) {
          console.error('Error saving conversations:', error);
        }
      }
    };

    if (conversations.length > 0) {
      // Always save to localStorage
      saveConversations(conversations);
      
      // Save to Supabase for logged in users
      if (user) {
        saveConversationsToSupabase();
      }
    }
  }, [conversations, user]);

  // Initialize Gmail access token on mount and auth state changes
  useEffect(() => {
    const initializeGmailAccess = async () => {
      // Check localStorage first
      const storedToken = localStorage.getItem('gmail_access_token');
      if (storedToken) {
        setGmailAccessToken(storedToken);
        return;
      }

      // Check current session for provider token
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        setGmailAccessToken(session.provider_token);
        localStorage.setItem('gmail_access_token', session.provider_token);
      }
    };

    initializeGmailAccess();

    // Listen for auth state changes to capture new tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        setGmailAccessToken(session.provider_token);
        localStorage.setItem('gmail_access_token', session.provider_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get Gmail access token
  const getGmailAccess = async () => {
    try {
      // Check if we already have a session with Google provider token
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        setGmailAccessToken(session.provider_token);
        localStorage.setItem('gmail_access_token', session.provider_token);
        return session.provider_token;
      }

      // If no token, initiate OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/directory.readonly',
          redirectTo: 'https://helpersh.vercel.app/'
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get Gmail access: " + error.message,
      });
    }
  };

  // Search directory for contacts
  const searchDirectory = async (query: string) => {
    if (!gmailAccessToken) {
      await getGmailAccess();
      return [];
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-directory', {
        body: { query, accessToken: gmailAccessToken }
      });

      if (error) throw error;
      return data.contacts || [];
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to search directory: " + error.message,
      });
      return [];
    }
  };

  // Send email via Gmail
  const sendEmail = async (to: string, subject: string, body: string) => {
    if (!gmailAccessToken) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gmail access required to send emails.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-gmail', {
        body: { to, subject, body, accessToken: gmailAccessToken }
      });

      if (error) throw error;

      toast({
        title: "Email sent!",
        description: `Email sent successfully to ${to}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send email: " + error.message,
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedImage) return;
    if (!activeConversationId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    // Update conversation with user message
    const updatedConversations = conversations.map(conv => 
      conv.id === activeConversationId 
        ? { 
            ...conv, 
            messages: [...conv.messages, userMessage],
            title: conv.title === 'New Chat' ? message.slice(0, 30) + (message.length > 30 ? '...' : '') : conv.title,
            timestamp: new Date()
          }
        : conv
    );
    setConversations(updatedConversations);

    setMessage('');
    setSelectedImage(null);
    setIsLoading(true);

    // Handle email requests
    if (message.toLowerCase().includes('send') && message.toLowerCase().includes('email')) {
      const emailMatch = message.match(/send.*email.*to\s+([^.]+)/i);
      if (emailMatch) {
        const contactName = emailMatch[1].trim();
        const contacts = await searchDirectory(contactName);
        
        if (contacts.length > 1) {
          // Multiple contacts found, show selector
          setContactSelector({
            isOpen: true,
            contacts,
            position: { x: 300, y: 200 }
          });
          setIsLoading(false);
          return;
        } else if (contacts.length === 1) {
          // Single contact found, open email composer
          setEmailComposer({
            isOpen: true,
            contacts: [contacts[0]]
          });
          setIsLoading(false);
          return;
        }
      }
    }

    // Call Gemini API for AI response
    try {
      const { data, error } = await supabase.functions.invoke('chat-gemini', {
        body: {
          message,
          image: selectedImage,
          conversationHistory: activeConversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            image: msg.image
          }))
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const aiResponse = data.response || data.fallbackResponse || "I'm here to help! What would you like to know or discuss?";
      
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      const finalConversations = updatedConversations.map(conv => 
        conv.id === activeConversationId 
          ? { ...conv, messages: [...conv.messages, aiMessage] }
          : conv
      );
      setConversations(finalConversations);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      
      // Fallback response on error
      const fallbackMessage: Message = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: "I'm having some trouble right now, but I'm still here to help! What would you like to know or discuss?",
        timestamp: new Date()
      };

      const finalConversations = updatedConversations.map(conv => 
        conv.id === activeConversationId 
          ? { ...conv, messages: [...conv.messages, fallbackMessage] }
          : conv
      );
      setConversations(finalConversations);
      setIsLoading(false);
      
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Having trouble connecting to AI service, but I'm still here to help!",
      });
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gradient-cosmic overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "flex-shrink-0 transition-all duration-300 ease-spring overflow-hidden",
        isSidebarOpen ? "w-80" : "w-0"
      )}>
        <Card className={cn(
          "h-full glass border-0 rounded-none backdrop-blur-glass transition-opacity duration-300",
          isSidebarOpen ? "opacity-100" : "opacity-0"
        )}>
           <div className="p-6 border-b border-border-glass space-y-3">
            <Button 
              onClick={createNewConversation}
              className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 font-medium"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-3" />
              New Chat
            </Button>
            {user && (
              <Button 
                onClick={signOut}
                variant="outline"
                className="w-full transition-all duration-300"
                size="sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
          
          <ScrollArea className="flex-1 p-4 custom-scrollbar">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <Button
                  key={conv.id}
                  variant={conv.id === activeConversationId ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-left h-auto p-4 transition-all duration-300",
                    conv.id === activeConversationId 
                      ? "bg-gradient-secondary shadow-glass text-secondary-foreground" 
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveConversationId(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e, conv.id)}
                >
                  <div className="truncate">{conv.title}</div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Card className="glass border-0 rounded-none backdrop-blur-glass">
          <div className="flex items-center justify-between p-6 border-b border-border-glass">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Sparkles className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse-glow"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Helper
                </h1>
                <p className="text-sm text-muted-foreground">
                  By{' '}
                  <a 
                    href="https://dhruv.ftp.sh" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-foreground transition-colors underline underline-offset-2"
                  >
                    Dhruv Gowda
                  </a>
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {!user ? (
                <Button
                  onClick={() => window.location.href = '/auth'}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Login with Google
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Welcome, {user.user_metadata?.full_name || user.email}
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </Card>

        {/* Messages */}
        <ScrollArea className="flex-1 custom-scrollbar">
          <div className="p-6 space-y-6">
            {activeConversation?.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4 animate-float-in",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'ai' && (
                  <Avatar className="w-10 h-10 border-2 border-primary/20">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={cn(
                  "max-w-[70%] space-y-2",
                  msg.role === 'user' && "order-1"
                )}>
                  {msg.image && (
                    <div className="rounded-lg overflow-hidden border border-border-glass">
                      <img 
                        src={msg.image} 
                        alt="Shared image" 
                        className="max-w-full h-auto"
                      />
                    </div>
                  )}
                  
                  <Card className={cn(
                    "p-4 transition-all duration-300",
                    msg.role === 'user'
                      ? "bg-gradient-primary text-primary-foreground shadow-glow ml-auto"
                      : "glass border-border-glass hover:shadow-glass"
                  )}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </Card>
                </div>

                {msg.role === 'user' && (
                  <Avatar className="w-10 h-10 border-2 border-accent/20 order-2">
                    <AvatarFallback className="bg-gradient-secondary text-secondary-foreground font-semibold">
                      You
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 animate-float-in">
                <Avatar className="w-10 h-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                    AI
                  </AvatarFallback>
                </Avatar>
                <Card className="glass border-border-glass p-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse-glow"></div>
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse-glow" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse-glow" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </Card>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <Card className="glass border-0 rounded-none backdrop-blur-glass">
          <div className="p-6 border-t border-border-glass">
            {selectedImage && (
              <Card className="mb-4 p-3 glass border-border-glass animate-slide-in-right">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={selectedImage} 
                      alt="Selected" 
                      className="w-12 h-12 rounded-lg object-cover border border-border-glass"
                    />
                    <span className="text-sm text-muted-foreground">Image selected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedImage(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}

            <div className="flex gap-3 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              <Button
                size="lg"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all duration-300"
              >
                <Camera className="w-5 h-5" />
              </Button>

              <div className="flex-1">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  className="min-h-[60px] max-h-[200px] glass border-border-glass focus:border-input-focus transition-all duration-300 resize-none"
                  disabled={isLoading}
                />
              </div>

              <Button
                size="lg"
                onClick={handleSendMessage}
                disabled={isLoading || (!message.trim() && !selectedImage)}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-2 min-w-[120px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
            onClick={() => deleteConversation(contextMenu.conversationId)}
          >
            Delete Chat
          </button>
        </div>
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={emailComposer.isOpen}
        onClose={() => setEmailComposer({ isOpen: false, contacts: [] })}
        selectedContacts={emailComposer.contacts}
        onSendEmail={sendEmail}
      />

      {/* Contact Selector */}
      <ContactSelector
        isOpen={contactSelector.isOpen}
        contacts={contactSelector.contacts}
        onSelectContact={(contact) => {
          setEmailComposer({ isOpen: true, contacts: [contact] });
          setContactSelector({ isOpen: false, contacts: [], position: { x: 0, y: 0 } });
        }}
        onClose={() => setContactSelector({ isOpen: false, contacts: [], position: { x: 0, y: 0 } })}
        position={contactSelector.position}
      />
    </div>
  );
};

export default ChatInterface;