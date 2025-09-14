import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DirectoryContact {
  id: string;
  contact_name: string;
  contact_email: string;
  department?: string;
  title?: string;
}

interface ContactSelectorProps {
  isOpen: boolean;
  contacts: DirectoryContact[];
  onSelectContact: (contact: DirectoryContact) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const ContactSelector: React.FC<ContactSelectorProps> = ({
  isOpen,
  contacts,
  onSelectContact,
  onClose,
  position,
}) => {
  if (!isOpen || contacts.length === 0) return null;

  return (
    <div 
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg max-w-md w-80"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-sm">Select Contact</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <ScrollArea className="max-h-60">
          <div className="space-y-2">
            {contacts.map((contact) => (
              <Card key={contact.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{contact.contact_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {contact.contact_email}
                      </div>
                      {contact.department && (
                        <div className="text-xs text-muted-foreground">
                          {contact.department}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectContact(contact);
                        onClose();
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ContactSelector;