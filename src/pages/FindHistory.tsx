import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatHistory {
  id: string;
  conversation_id: string;
  title: string;
  messages: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const FindHistory = () => {
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'EdisonSchools') {
      setAuthenticated(true);
      toast({
        title: "Access granted",
        description: "You can now search for chat histories.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Incorrect password.",
      });
    }
  };

  const searchChatHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First get the user's ID from their email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', userEmail)
        .single();

      if (profileError || !profiles) {
        toast({
          variant: "destructive",
          title: "User not found",
          description: "No user found with that email address.",
        });
        return;
      }

      // Get chat histories for this user
      const { data: histories, error: historiesError } = await supabase
        .from('chat_histories')
        .select('*')
        .eq('user_id', profiles.user_id)
        .order('updated_at', { ascending: false });

      if (historiesError) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch chat histories.",
        });
        return;
      }

      setChatHistories(histories || []);
      toast({
        title: "Chat histories loaded",
        description: `Found ${histories?.length || 0} chat conversations.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background-soft to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Find Chat History
            </CardTitle>
            <CardDescription>
              Enter the admin password to access user chat histories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Access
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background-soft to-accent/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Search User Chat History
            </CardTitle>
            <CardDescription>
              Enter a user's email to view their chat conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchChatHistory} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter user's email address..."
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {chatHistories.length > 0 && (
          <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
            <CardHeader>
              <CardTitle>Chat Histories for {userEmail}</CardTitle>
              <CardDescription>
                {chatHistories.length} conversation(s) found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full">
                <div className="space-y-4">
                  {chatHistories.map((history) => (
                    <Card key={history.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-lg">{history.title}</h3>
                          <span className="text-sm text-muted-foreground">
                            {new Date(history.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {Array.isArray(history.messages) && history.messages.map((message: any, index: number) => (
                            <div
                              key={index}
                              className={`p-2 rounded-lg text-sm ${
                                message.role === 'user'
                                  ? 'bg-accent/20 ml-8'
                                  : 'bg-muted/50 mr-8'
                              }`}
                            >
                              <div className="font-medium text-xs mb-1">
                                {message.role === 'user' ? 'User' : 'AI'}
                              </div>
                              <div>{message.content}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FindHistory;