import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Send, 
  Image as ImageIcon, 
  Plus, 
  User, 
  Sparkles, 
  MoreVertical, 
  Trash2, 
  X, 
  Menu, 
  ChevronLeft,
  LogOut
} from 'lucide-react';
import ContactSelector from './ContactSelector';
import EmailComposer from './EmailComposer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

const ChatInterface: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [emailComposer, setEmailComposer] = useState<{ isOpen: boolean; contacts: any[] }>({ isOpen: false, contacts: [] });
  const [contactSelector, setContactSelector] = useState<{ isOpen: boolean; contacts: any[]; position: { x: number; y: number } }>({ isOpen: false, contacts: [], position: { x: 0, y: 0 } });
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Save to localStorage for guests, Supabase for logged in users
  const saveConversations = (convs: Conversation[]) => {
    localStorage.setItem('chat_conversations', JSON.stringify(convs));
  };

  // Load from localStorage for guests
  const loadConversations = () => {
    try {
      const saved = localStorage.getItem('chat_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        const convs = parsed.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setConversations(convs);
        
        if (convs.length > 0 && !activeConversationId) {
          setActiveConversationId(convs[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      timestamp: new Date()
    };
    
    const updatedConversations = [newConv, ...conversations];
    setConversations(updatedConversations);
    setActiveConversationId(newConv.id);
    setMessage('');
    setSelectedImage(null);
    
    // Close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const deleteConversation = (convId: string) => {
    const filtered = conversations.filter(c => c.id !== convId);
    setConversations(filtered);
    
    if (activeConversationId === convId) {
      if (filtered.length > 0) {
        setActiveConversationId(filtered[0].id);
      } else {
        createNewConversation();
      }
    }
    setContextMenu(null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle window resize for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Initialize conversations when component mounts or user changes
    loadConversations();
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversationId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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
          conversationHistory: updatedConversations.find(c => c.id === activeConversationId)!.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            image: msg.image
          }))
        }
      });

      if (error) {
        throw error;
      }

      if (data && data.response) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };

        // Add AI response to conversations
        const finalConversations = updatedConversations.map(conv => 
          conv.id === activeConversationId 
            ? { ...conv, messages: [...conv.messages, aiMessage] }
            : conv
        );
        setConversations(finalConversations);
      }
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get AI response. Please try again.",
      });
      
      // Add error message to conversation
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date()
      };

      const finalConversations = updatedConversations.map(conv => 
        conv.id === activeConversationId 
          ? { ...conv, messages: [...conv.messages, errorMessage] }
          : conv
      );
      setConversations(finalConversations);
    } finally {
      setIsLoading(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || {
    id: '',
    title: 'New Chat',
    messages: [],
    timestamp: new Date()
  };

  // Create initial conversation if none exist
  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  }, []);

  return (
    <div className="flex h-screen bg-gradient-cosmic overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Helper</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewConversation}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "flex-shrink-0 transition-all duration-300 ease-spring overflow-hidden",
        "md:relative fixed inset-y-0 left-0 z-40",
        isSidebarOpen ? "w-80" : "w-0",
        "md:block", // Always visible on desktop
        !isSidebarOpen && "md:w-0" // But still collapsible
      )}>
        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Card className={cn(
          "h-full glass border-0 rounded-none backdrop-blur-glass transition-opacity duration-300 relative z-40",
          isSidebarOpen ? "opacity-100" : "opacity-0",
          "md:mt-0 mt-16" // Account for mobile header
        )}>
           <div className="p-6 border-b border-border-glass space-y-3">
            <Button 
              onClick={createNewConversation}
              className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-200 shadow-elegant text-white border-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
            
            {/* Desktop-only close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(false)}
              className="hidden md:flex w-full justify-center"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "relative group cursor-pointer rounded-lg p-3 transition-all duration-200 hover:bg-accent/50",
                    activeConversationId === conv.id ? 'bg-gradient-primary/10 border border-primary/20' : ''
                  )}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    // Close sidebar on mobile after selecting conversation
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {conv.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conv.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          conversationId: conv.id
                        });
                      }}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => deleteConversation(contextMenu.conversationId)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <div className="hidden md:flex justify-between items-center p-6 border-b border-border-glass">
          {!isSidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 mr-2" />
              Show Sidebar
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <ContactSelector 
              isOpen={contactSelector.isOpen}
              contacts={contactSelector.contacts}
              position={contactSelector.position}
              onSelectContact={(contact) => {
                setContactSelector({ isOpen: false, contacts: [], position: { x: 0, y: 0 } });
                setEmailComposer({ isOpen: true, contacts: [contact] });
              }}
              onClose={() => setContactSelector({ isOpen: false, contacts: [], position: { x: 0, y: 0 } })}
            />
            
            <EmailComposer
              isOpen={emailComposer.isOpen}
              selectedContacts={emailComposer.contacts}
              onClose={() => setEmailComposer({ isOpen: false, contacts: [] })}
              onSendEmail={sendEmail}
            />
            
            {user && (
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-6 pb-32 md:pb-32 space-y-6">
              {activeConversation.messages.length === 0 ? (
                <div className="text-center text-muted-foreground mt-20">
                  <h2 className="text-2xl md:text-3xl font-semibold mb-4">How can I help you today?</h2>
                  <p className="text-base md:text-lg">Start a conversation by typing a message below.</p>
                </div>
              ) : (
                activeConversation.messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 md:gap-4",
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 md:px-6 md:py-4",
                        msg.role === 'user'
                          ? 'bg-gradient-primary text-white ml-auto'
                          : 'bg-card/50 backdrop-blur-sm border border-border/50'
                      )}
                    >
                      {msg.image && (
                        <div className="mb-3">
                          <img 
                            src={msg.image} 
                            alt="Uploaded content" 
                            className="max-w-full h-auto rounded-lg max-h-48 md:max-h-64"
                          />
                        </div>
                      )}
                      <div className="text-sm md:text-base whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                      <div className={cn(
                        "text-xs mt-2 opacity-70",
                        msg.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                      )}>
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 md:h-5 md:w-5 text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex gap-3 md:gap-4 justify-start">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl px-4 py-3 md:px-6 md:py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      </div>
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 to-transparent backdrop-blur-xl border-t border-border/50">
          {selectedImage && (
            <div className="mb-4 p-3 bg-card/50 rounded-lg border border-border/50 flex items-center gap-3">
              <img src={selectedImage} alt="Selected" className="w-12 h-12 md:w-16 md:h-16 rounded object-cover" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Image selected</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2 md:gap-3 items-end">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            
            {/* Mobile user menu button */}
            <div className="md:hidden">
              {user && (
                <Button variant="outline" size="icon" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                className="min-h-[60px] md:min-h-[80px] resize-none pr-12 md:pr-16 text-sm md:text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={(!message.trim() && !selectedImage) || isLoading}
                size="icon"
                className="absolute right-2 bottom-2 h-8 w-8 md:h-10 md:w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;