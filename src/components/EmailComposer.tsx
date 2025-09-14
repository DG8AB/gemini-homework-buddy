import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface DirectoryContact {
  id: string;
  contact_name: string;
  contact_email: string;
  department?: string;
  title?: string;
}

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContacts: DirectoryContact[];
  onSendEmail: (to: string, subject: string, body: string) => void;
}

const EmailComposer: React.FC<EmailComposerProps> = ({
  isOpen,
  onClose,
  selectedContacts,
  onSendEmail,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in both subject and message.",
      });
      return;
    }

    selectedContacts.forEach(contact => {
      onSendEmail(contact.contact_email, subject, body);
    });

    toast({
      title: "Emails sent!",
      description: `Sent to ${selectedContacts.length} recipient(s).`,
    });

    onClose();
    setSubject('');
    setBody('');
    setShowPreview(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Compose Email</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </CardTitle>
          <CardDescription>
            Sending to: {selectedContacts.map(c => c.contact_name).join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPreview ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter your message..."
                  rows={10}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowPreview(true)}>
                  Preview
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold">Email Preview</h3>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div>
                    <strong>To:</strong> {selectedContacts.map(c => `${c.contact_name} <${c.contact_email}>`).join(', ')}
                  </div>
                  <div>
                    <strong>Subject:</strong> {subject}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="whitespace-pre-wrap">{body}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSend}>
                  Send Email
                </Button>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Back to Edit
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailComposer;