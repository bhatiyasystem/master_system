import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
;
import { useMagicToast } from '@/context/MagicToastContext';
import { whatsappLogService } from '@/services/whatsappService';
import supabase from '@/SupabaseClient';
import { Image as _ImageIcon, Check, User, Download, RefreshCw, MoreVertical, Search, Clock, Phone, ChevronLeft, Smile, X, FileText, CornerUpRight, ImageIcon, Plus, Send, CheckCheck, XCircle } from 'lucide-react';

const getDisplayableImageUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    const trimmedUrl = url.trim();
    try {
        if (/^[a-zA-Z0-9_-]{28,35}$/.test(trimmedUrl)) {
            return `https://drive.google.com/thumbnail?id=${trimmedUrl}&sz=w150`;
        }
        let driveId = null;
        const ucExportMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const directMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const openMatch = trimmedUrl.match(/open\?id=([a-zA-Z0-9_-]+)/);
        if (directMatch) driveId = directMatch[1];
        else if (openMatch) driveId = openMatch[1];
        else if (ucExportMatch && (trimmedUrl.includes("drive.google.com") || trimmedUrl.includes("docs.google.com"))) {
            driveId = ucExportMatch[1];
        }
        if (driveId) {
            return `https://drive.google.com/thumbnail?id=${driveId}&sz=w150`;
        }
        if (trimmedUrl.includes("drive.google.com") || trimmedUrl.includes("docs.google.com")) {
            const anyIdMatch = trimmedUrl.match(/([a-zA-Z0-9_-]{25,})/);
            if (anyIdMatch && anyIdMatch[1]) {
                return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w150`;
            }
        }
        return trimmedUrl;
    } catch (e) {
        console.error("Error processing image URL:", url, e);
        return trimmedUrl;
    }
};

/**
 * WhatsappHistory 
 * A premium WhatsApp-style interface for auditing message logs.
 */
const WhatsappHistory = () => {
    const { showToast } = useMagicToast();
    const toast = useMemo(() => ({
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        info: (msg) => showToast(msg, 'info'),
        warning: (msg) => showToast(msg, 'warning')
    }), [showToast]);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedContactId, setSelectedContactId] = useState(null);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, seen, unseen
    const chatEndRef = useRef(null);
    const unreadRef = useRef(null);
    const selectedContactIdRef = useRef(selectedContactId);

    const [templates, setTemplates] = useState({});
    const [syncingTemplates, setSyncingTemplates] = useState(false);
    const [usersList, setUsersList] = useState([]);

    // File/Emoji Features
    const [showEmojiPanel, setShowEmojiPanel] = useState(false);
    const [showAttachPanel, setShowAttachPanel] = useState(false);
    const [activeEmojiTab, setActiveEmojiTab] = useState('emoji');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState('');
    const [fileType, setFileType] = useState('media'); // media, document
    const [fileCaption, setFileCaption] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);

    // Reactions & Forwarding state
    const [reactions, setReactions] = useState({});
    const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
    const [showMoreReactionsMsgId, setShowMoreReactionsMsgId] = useState(null);
    const [showReactionDetailsMsgId, setShowReactionDetailsMsgId] = useState(null);
    const [forwardingMsg, setForwardingMsg] = useState(null);
    const [forwardSearch, setForwardSearch] = useState('');

    const mediaInputRef = useRef(null);
    const docInputRef = useRef(null);
    const textInputRef = useRef(null);

    // Click outside to close reactions
    useEffect(() => {
        const handleOutsideClick = () => {
            setActiveReactionMsgId(null);
            setShowMoreReactionsMsgId(null);
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const handleMediaChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setFileType('media');
        setFileCaption('');
        setFilePreviewUrl(URL.createObjectURL(file));
        setShowAttachPanel(false);
    };

    const handleDocChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setFileType('document');
        setFileCaption('');
        setFilePreviewUrl('');
        setShowAttachPanel(false);
    };

    const cancelFileSend = () => {
        setSelectedFile(null);
        if (filePreviewUrl) {
            URL.revokeObjectURL(filePreviewUrl);
            setFilePreviewUrl('');
        }
    };

    const sendFileMessage = async () => {
        if (!selectedFile || !selectedContact || uploadingFile) return;

        setUploadingFile(true);
        try {
            const file = selectedFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `wa_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const bucketName = 'task-instructions';
            
            // Upload to Supabase Storage
            const { _data, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            // Log entry
            const logEntry = {
                recipient_name: selectedContact.name,
                phone_number: selectedContact.phone,
                message_type: fileType === 'media' ? 'Image' : 'Document',
                stage: 'Support',
                message_content: fileCaption.trim() || (fileType === 'media' ? `[Media File]: ${file.name}` : `[Document File]: ${file.name}`),
                status: 'Sent',
                sender_name: 'Manual',
                reference_id: 'Manual',
                media_url: publicUrl,
                mime_type: file.type,
                file_name: file.name,
                direction: 'outbound'
            };

            const { error: dbError } = await supabase.from('whatsapp_logs').insert([logEntry]);
            if (dbError) throw dbError;

            toast.success(`${fileType === 'media' ? 'Photo/Video' : 'Document'} sent successfully`);
            cancelFileSend();
        } catch (error) {
            console.error('File send error:', error);
            toast.error('Failed to send file: ' + error.message);
        } finally {
            setUploadingFile(false);
        }
    };

    const appendEmoji = (emoji) => {
        const input = textInputRef.current;
        if (!input) {
            setNewMessage(prev => prev + emoji);
            return;
        }

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        setNewMessage(before + emoji + after);

        // Focus back and set selection cursor
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
    };

    const sendGifOrSticker = async (url, type) => {
        if (!selectedContact || sending) return;

        setSending(true);
        try {
            const logEntry = {
                recipient_name: selectedContact.name,
                phone_number: selectedContact.phone,
                message_type: type === 'gif' ? 'GIF' : 'Sticker',
                stage: 'Support',
                message_content: type === 'gif' ? '[GIF message]' : '[Sticker message]',
                status: 'Sent',
                sender_name: 'Manual',
                reference_id: 'Manual',
                media_url: url,
                mime_type: type === 'gif' ? 'image/gif' : 'image/svg+xml',
                file_name: type === 'gif' ? 'animation.gif' : 'sticker.svg',
                direction: 'outbound'
            };

            const { error: dbError } = await supabase.from('whatsapp_logs').insert([logEntry]);
            if (dbError) throw dbError;

            setShowEmojiPanel(false);
            toast.success(`${type === 'gif' ? 'GIF' : 'Sticker'} sent successfully`);
        } catch (error) {
            console.error('Error sending GIF/Sticker:', error);
            toast.error(`Failed to send ${type}`);
        } finally {
            setSending(false);
        }
    };

    const emojiList = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤠","👿","👻","💀","👽","👾","🤖","🎃","👋","🤚","🖐️","✋","🖖","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","👃","🧠","🦷","🦴","👀","👁️","👅","👄","💋","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","🔥","🎉","✨","🌟","🎈","🎂"];

    const gifList = [
        { name: "Wave", url: "https://media.giphy.com/media/3ornk57KwDXf81rjWM/giphy.gif" },
        { name: "Thumbs Up", url: "https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif" },
        { name: "Nod", url: "https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif" },
        { name: "Laugh", url: "https://media.giphy.com/media/10yXFYdBJFBmo/giphy.gif" },
        { name: "Shocked", url: "https://media.giphy.com/media/3o7527pa7qs9kCG78A/giphy.gif" },
        { name: "Applause", url: "https://media.giphy.com/media/21H967QPzNWDAcrO8b/giphy.gif" }
    ];

    const stickerList = [
        { name: "Grin Cat", url: "https://api.iconify.design/twemoji:grinning-cat-with-smiling-eyes.svg" },
        { name: "Heart Cat", url: "https://api.iconify.design/twemoji:smiling-cat-with-heart-eyes.svg" },
        { name: "Rocket", url: "https://api.iconify.design/twemoji:rocket.svg" },
        { name: "Fire", url: "https://api.iconify.design/twemoji:fire.svg" },
        { name: "Target", url: "https://api.iconify.design/twemoji:bullseye.svg" },
        { name: "Party", url: "https://api.iconify.design/twemoji:party-popper.svg" }
    ];

    const fetchUserProfiles = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('user_name, number');
            if (error) throw error;
            setUsersList(data || []);
        } catch (error) {
            console.error('Error fetching user profiles:', error);
        }
    }, []);

    // Close panels when switching contact
    useEffect(() => {
        setShowEmojiPanel(false);
        setShowAttachPanel(false);
    }, [selectedContactId]);

    // Update ref whenever state changes
    useEffect(() => {
        selectedContactIdRef.current = selectedContactId;
    }, [selectedContactId]);

    const fetchTemplates = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('whatsapp_templates').select('*');
            if (error) throw error;
            const templateMap = {};
            data.forEach(t => {
                templateMap[t.name] = t;
            });
            setTemplates(templateMap);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    }, []);

    const handleSyncTemplates = async () => {
        setSyncingTemplates(true);
        try {
            const count = await whatsappLogService.syncTemplates();
            toast.success(`Successfully synced ${count} templates from Meta`);
            await fetchTemplates();
        } catch (error) {
            console.error('Sync templates error:', error);
            toast.error(error.message || 'Failed to sync templates');
        } finally {
            setSyncingTemplates(false);
        }
    };

    const renderTemplate = (bodyText, headerText, footerText, buttons, params) => {
        try {
            // Replace placeholders like {{1}}, {{2}} with params
            let formattedText = bodyText || '';
            params.forEach((param, idx) => {
                const placeholder = `{{${idx + 1}}}`;
                formattedText = formattedText.replaceAll(placeholder, param || 'N/A');
            });

            return (
                <div className="space-y-1.5 text-left">
                    {headerText && (
                        <div className="font-bold text-[#111b21] text-[13px] border-b border-black/5 pb-1 mb-1">
                            {headerText}
                        </div>
                    )}
                    <div className="text-[13px] text-[#303030] leading-relaxed whitespace-pre-wrap">{formattedText}</div>
                    {footerText && (
                        <div className="text-[10px] text-[#667781] mt-1">
                            {footerText}
                        </div>
                    )}
                    {buttons && Array.isArray(buttons) && buttons.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-black/5 flex flex-wrap gap-1.5">
                            {buttons.map((btn, bIdx) => (
                                <span key={bIdx} className="bg-black/5 text-[#008069] text-[10px] font-semibold px-2 py-0.5 rounded border border-black/5">
                                    {btn.text || btn.type}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            );
        } catch (err) {
            console.error("Error rendering template layout:", err);
            return params.join(" | ");
        }
    };

    const formatTemplateMessage = (msg) => {
        if (!msg || !msg.message_content) {
            return '';
        }

        const messageContent = msg.message_content;
        let templateName = null;
        let params = [];

        // Check if database-level join template fields are present in the row
        if (msg.template_body) {
            // Extract params
            if (messageContent.startsWith("Template: ")) {
                try {
                    const parts = messageContent.split(" | Params: ");
                    if (parts.length >= 2) {
                        const paramsString = parts[1];
                        params = paramsString.split(" | ").map(p => p.trim());
                    }
                } catch (err) {
                    console.error("Error parsing params from structured template message content", err);
                }
            } else {
                params = messageContent.split("|").map(p => p.trim());
            }

            return renderTemplate(msg.template_body, msg.template_header, msg.template_footer, msg.template_buttons, params);
        }

        // Fallback: Parse dynamically using client-side fetched templates (for realtime updates or unsynced items)
        
        // 1. Try "Template: name | Params: Param1 | Param2" format
        if (messageContent.startsWith("Template: ")) {
            try {
                const parts = messageContent.split(" | Params: ");
                if (parts.length >= 2) {
                    templateName = parts[0].replace("Template: ", "").trim();
                    const paramsString = parts[1];
                    params = paramsString.split(" | ").map(p => p.trim());
                }
            } catch (err) {
                console.error("Error parsing Template: format", err);
            }
        }

        // 2. Parse PO creation messages formatted as "PO {poNo} issued to {vendorName} on {poDate}"
        if (!templateName) {
            const poMatch = messageContent.match(/^PO\s+(.+?)\s+issued to\s+(.+?)(?:\s+on\s+(.+?)|\s+\(No contact number available\))?$/i);
            if (poMatch || msg.message_type === 'Purchase Order' || msg.message_type === 'purchase_po') {
                templateName = 'purchase_po';
                if (poMatch) {
                    const poNo = poMatch[1]?.trim();
                    const vendorName = poMatch[2]?.trim();
                    const poDate = poMatch[3]?.trim() || 'N/A';
                    params = [vendorName || msg.recipient_name || 'Vendor', poNo || msg.reference_id || 'N/A', poDate];
                } else {
                    params = [msg.recipient_name || 'Vendor', msg.reference_id || 'N/A', 'N/A'];
                }
            }
        }

        // 3. Fallback: If message_type matches a known template (case-insensitive), treat content as pipe-separated parameters
        if (!templateName && msg.message_type) {
            const normalizedType = msg.message_type.trim().toLowerCase();
            const matchedTemplateKey = Object.keys(templates).find(
                key => key.toLowerCase() === normalizedType
            );
            if (matchedTemplateKey) {
                templateName = matchedTemplateKey;
                params = messageContent.split("|").map(p => p.trim());
            }
        }

        if (templateName) {
            let template = templates[templateName];
            // Built-in fallback template for purchase_po if template has not been synced to whatsapp_templates yet
            if ((!template || !template.body_text) && templateName === 'purchase_po') {
                template = {
                    body_text: "Dear {{1}},\n\nA new Purchase Order has been issued to you.\nPO Number: {{2}}\nPO Date: {{3}}\n\nPlease process the order as per the Purchase Order details.\n\nThank you.",
                    header_text: "Purchase Order Issued",
                    footer_text: "Purchase Department"
                };
            }

            if (!template || !template.body_text) {
                return (
                    <div className="space-y-1.5 text-left">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#008069]">Template: {templateName}</div>
                        <div className="text-[13px] text-[#111b21] border-l-2 border-slate-300 pl-2 py-0.5 mt-1">{params.join(" | ")}</div>
                    </div>
                );
            }
            return renderTemplate(template.body_text, template.header_text, template.footer_text, template.buttons, params);
        }

        return messageContent;
    };

    const formatLastMessagePreview = (messageContent) => {
        if (!messageContent) return '';
        if (messageContent.startsWith("Template: purchase_po | Params: ")) {
            const parts = messageContent.replace("Template: purchase_po | Params: ", "").split(" | ");
            return `PO ${parts[1] || ''} issued to ${parts[0] || ''}`;
        }
        if (messageContent.startsWith("Template: ")) {
            return messageContent.replace(/^Template:\s*[\w_-]+\s*\|\s*Params:\s*/, '');
        }
        return messageContent;
    };

    // Fetch logs from Supabase
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await whatsappLogService.fetchLogs();
            setLogs(data);
        } catch (error) {
            console.error('Error fetching logs:', error);
            toast.error('Failed to load message history');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLogs();
        fetchTemplates();
        fetchUserProfiles();

        const unsubscribe = whatsappLogService.subscribeToChanges((eventType, data) => {
            if (eventType === 'INSERT') {
                const key = data.phone_number || data.recipient_name;

                if (key === selectedContactIdRef.current && data.is_read === false) {
                    markMessagesAsRead(key);
                }

                setLogs(prev => {
                    if (prev.some(log => log.id === data.id)) return prev;
                    return [data, ...prev];
                });

                if (data.status === 'Received') {
                    toast.success(`New message from ${data.recipient_name || 'Customer'}`);
                }
            } else if (eventType === 'UPDATE') {
                setLogs(prev => prev.map(log =>
                    log.id === data.id ? data : log
                ));
            }
        });

        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedContactId || sending) return;

        setSending(true);
        try {
            const { sendWhatsAppTextMessage } = await import('@/services/whatsappService');
            await sendWhatsAppTextMessage(selectedContact.phone, newMessage, {
                recipientName: selectedContact.name,
                referenceId: 'Manual'
            });

            setNewMessage('');
            // No need for fetchLogs() here, the realtime listener will pick it up
            toast.success('Message sent');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSending(false);
        }
    };

    const markMessagesAsRead = useCallback(async (contactId) => {
        try {
            await whatsappLogService.markMessagesAsRead(contactId);
            setLogs(prev => prev.map(log => {
                const key = log.phone_number || log.recipient_name;
                if (key === contactId) {
                    return { ...log, is_read: true };
                }
                return log;
            }));
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }, []);

    useEffect(() => {
        if (selectedContactId) {
            markMessagesAsRead(selectedContactId);
        }
    }, [selectedContactId, markMessagesAsRead]);

    // Group logs by contact
    const contacts = useMemo(() => {
        const map = new Map();
        logs.forEach(log => {
            const key = log.phone_number || log.recipient_name;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    phone: log.phone_number,
                    lastMessage: log.message_content,
                    lastDate: log.created_at,
                    unreadCount: 0,
                    logs: []
                });
            }
            const contact = map.get(key);
            contact.logs.push(log);
            if (log.is_read === false && log.status === 'Received') {
                contact.unreadCount += 1;
            }
        });

        // Resolve name/profile image per contact using the full conversation
        map.forEach((contact) => {
            const cleanPhone = contact.phone ? String(contact.phone).replace(/\D/g, '') : '';
            const matchUser = usersList.find(u => {
                if (!u) return false;
                const cleanUPhone = u.number ? String(u.number).replace(/\D/g, '') : '';
                if (cleanPhone && cleanUPhone) {
                    if (cleanPhone.endsWith(cleanUPhone) || cleanUPhone.endsWith(cleanPhone)) {
                        return true;
                    }
                }
                return contact.logs.some(l => l.recipient_name && u.user_name &&
                    l.recipient_name.trim().toLowerCase() === u.user_name.trim().toLowerCase());
            });

            contact.profileImage = matchUser?.image || null;

            const namedLog = contact.logs.find(l => 
                l.recipient_name && 
                l.recipient_name.trim().toLowerCase() !== 'unknown' && 
                l.recipient_name.trim().toLowerCase() !== 'whatsapp user' &&
                !/^\+?\d+$/.test(l.recipient_name.trim())
            );

            if (matchUser) {
                contact.name = matchUser.user_name;
            } else if (namedLog) {
                contact.name = namedLog.recipient_name;
            } else if (contact.phone) {
                const rawP = String(contact.phone).trim();
                contact.name = rawP.startsWith('+') ? rawP : `+${rawP}`;
            } else {
                const fallbackLog = contact.logs.find(l => l.recipient_name && l.recipient_name.trim().toLowerCase() !== 'unknown');
                contact.name = fallbackLog?.recipient_name || 'WhatsApp Contact';
            }
        });

        let contactList = Array.from(map.values());

        // Apply Category Filtering
        if (filterType === 'seen') {
            contactList = contactList.filter(c => c.unreadCount === 0);
        } else if (filterType === 'unseen') {
            contactList = contactList.filter(c => c.unreadCount > 0);
        }

        // Apply Search Filtering
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            contactList = contactList.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.phone?.includes(term) ||
                c.lastMessage?.toLowerCase().includes(term)
            );
        }

        return contactList.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    }, [logs, searchTerm, filterType, usersList]);

    const selectedContact = useMemo(() =>
        contacts.find(c => c.id === selectedContactId),
        [contacts, selectedContactId]);

    const chatMessages = useMemo(() => {
        if (!selectedContact) return [];
        return [...selectedContact.logs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }, [selectedContact]);

    // Scroll to first unread or bottom
    useEffect(() => {
        if (unreadRef.current) {
            unreadRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
            chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [chatMessages]);

    const formatMessageTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatChatDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'TODAY';
        if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';

        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
    };

    const renderStatusCheck = (msg) => {
        if (msg.status === 'Sent') {
            return <Check size={15} className="text-[#667781] shrink-0" />;
        }
        if (msg.status === 'Delivered') {
            return <CheckCheck size={15} className="text-[#667781] shrink-0" />;
        }
        if (msg.status === 'Read' || msg.status === 'Success') {
            return <CheckCheck size={15} className="text-[#53bdeb] shrink-0" />;
        }
        return (
            <XCircle 
                size={14} 
                className="text-rose-500 shrink-0 cursor-help" 
                title={`Failed: ${msg.error_message || 'Unknown Error'}${msg.error_code ? ` (Code: ${msg.error_code})` : ''}`}
            />
        );
    };

    const isToday = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    };

    const handleReact = (msgId, emoji) => {
        setReactions(prev => {
            if (prev[msgId] === emoji) {
                const copy = { ...prev };
                delete copy[msgId];
                return copy;
            }
            return { ...prev, [msgId]: emoji };
        });
        setActiveReactionMsgId(null);
    };

    const handleForwardMessage = async (contact, msgToForward) => {
        if (!msgToForward) return;
        try {
            const { sendWhatsAppTextMessage } = await import('@/services/whatsappService');
            
            if (msgToForward.media_url) {
                // Insert a media message log entry
                const logEntry = {
                    recipient_name: contact.name,
                    phone_number: contact.phone,
                    message_type: msgToForward.message_type,
                    stage: 'Support',
                    message_content: msgToForward.message_content,
                    status: 'Sent',
                    sender_name: 'Manual',
                    reference_id: 'Manual',
                    media_url: msgToForward.media_url,
                    mime_type: msgToForward.mime_type,
                    file_name: msgToForward.file_name,
                    direction: 'outbound'
                };
                const { error } = await supabase.from('whatsapp_logs').insert([logEntry]);
                if (error) throw error;
            } else {
                // Send text message
                await sendWhatsAppTextMessage(contact.phone, msgToForward.message_content, {
                    recipientName: contact.name,
                    referenceId: 'Manual'
                });
            }
            toast.success(`Message forwarded to ${contact.name}`);
        } catch (error) {
            console.error('Error forwarding message:', error);
            toast.error('Failed to forward message: ' + error.message);
        }
    };

    // Group messages by date for display
    const groupedMessages = useMemo(() => {
        const groups = [];
        let currentGroup = null;

        chatMessages.forEach(msg => {
            const date = new Date(msg.created_at).toDateString();
            if (!currentGroup || currentGroup.date !== date) {
                currentGroup = { date, label: formatChatDate(msg.created_at), messages: [] };
                groups.push(currentGroup);
            }
            currentGroup.messages.push(msg);
        });

        return groups;
    }, [chatMessages]);

    return (
        <div className="flex h-[calc(100vh-84px)] w-[calc(100%+32px)] md:w-[calc(100%+48px)] mx-[-16px] md:mx-[-24px] mb-[-96px] md:mb-[-24px] overflow-hidden bg-white font-sans antialiased">
            {/* Styles for WhatsApp pattern and animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .wa-bg {
                    background-color: #efeae2;
                    background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
                    background-blend-mode: overlay;
                    opacity: 0.4;
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .message-bubble::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    width: 0;
                    height: 0;
                    border: 8px solid transparent;
                }
                .message-bubble-sent::after {
                    right: -8px;
                    border-left-color: #d9fdd3;
                    border-top-color: #d9fdd3;
                }
                .message-bubble-received::after {
                    left: -8px;
                    border-right-color: #ffffff;
                    border-top-color: #ffffff;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
            `}} />

            {/* Sidebar: Conversations List */}
            <div className={`flex flex-col w-full md:w-[30%] lg:w-[25%] min-w-[320px] border-r border-[#d1d7db] bg-white transition-all duration-300 ${!sidebarVisible && 'hidden md:flex'}`}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#ebf2ee] h-[60px] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d2e0d7] flex items-center justify-center text-[#0b6656]">
                            <User size={24} />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-[#111b21] font-bold text-sm leading-tight">WhatsApp Business</h1>
                            <p className="text-[#0b6656] text-[10px] uppercase font-bold tracking-tighter">Meta Business API</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[#0b6656]">
                        <button onClick={handleSyncTemplates} className="hover:text-[#111b21] transition-colors" disabled={syncingTemplates} title="Sync Templates from Meta">
                            <Download size={18} className={syncingTemplates ? 'animate-bounce text-[#00a884]' : ''} />
                        </button>
                        <button onClick={fetchLogs} className="hover:text-[#111b21] transition-colors" title="Refresh Logs">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <MoreVertical size={20} />
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="p-2 space-y-2 shrink-0">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667781] flex items-center">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search or start new chat"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-12 pr-4 bg-[#f0f2f5] border-none rounded-lg text-[#111b21] text-sm focus:outline-none placeholder-[#667781]"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-1">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all ${filterType === 'all' ? 'bg-[#e1f3ec] text-[#008069]' : 'text-[#667781] hover:bg-[#f0f2f5]'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('seen')}
                            className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all ${filterType === 'seen' ? 'bg-[#e1f3ec] text-[#008069]' : 'text-[#667781] hover:bg-[#f0f2f5]'}`}
                        >
                            Seen
                        </button>
                        <button
                            onClick={() => setFilterType('unseen')}
                            className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all ${filterType === 'unseen' ? 'bg-[#e1f3ec] text-[#008069]' : 'text-[#667781] hover:bg-[#f0f2f5]'}`}
                        >
                            Unseen
                        </button>
                    </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-[#e9edef]">
                    {loading ? (
                        <div className="flex flex-col p-4 gap-4 animate-pulse">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#f0f2f5]"></div>
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-[#f0f2f5] rounded w-1/3"></div>
                                        <div className="h-2 bg-[#f0f2f5] rounded w-full"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#667781] p-6 text-center space-y-3">
                            <Clock size={48} className="opacity-20" />
                            <p className="text-sm">No conversations found.</p>
                        </div>
                    ) : (
                        contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => {
                                    setSelectedContactId(contact.id);
                                    if (window.innerWidth < 768) setSidebarVisible(false);
                                }}
                                className={`flex items-center gap-3 px-3 h-[72px] cursor-pointer border-b border-[#e9edef] transition-colors relative group
                                    ${selectedContactId === contact.id ? 'bg-[#e9edef]' : 'hover:bg-[#f0f2f5]'}
                                `}
                            >
                                {contact.profileImage ? (
                                    <img 
                                        src={getDisplayableImageUrl(contact.profileImage)} 
                                        alt={contact.name} 
                                        className="w-12 h-12 rounded-full object-cover shrink-0" 
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-[#d2e0d7] flex items-center justify-center text-[#0b6656] text-lg font-bold shrink-0">
                                        {contact.name.startsWith('+') ? <Phone size={22} /> : contact.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="text-[#111b21] font-medium text-[15px] truncate">{contact.name}</h3>
                                        <span className={`text-[12px] ${selectedContactId === contact.id ? 'text-[#008069]' : 'text-[#667781]'}`}>
                                            {new Date(contact.lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[#667781]">
                                                <CheckCheck size={14} className="text-[#53bdeb]" />
                                            </span>
                                            <p className="text-[#667781] text-[13px] truncate">{formatLastMessagePreview(contact.lastMessage)}</p>
                                        </div>
                                        {contact.unreadCount > 0 && (
                                            <div className="bg-[#00a884] text-white text-[12px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 animate-in zoom-in duration-300">
                                                {contact.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 relative bg-[#efeae2] ${sidebarVisible && 'hidden md:flex'}`}>
                {selectedContact ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-[#ebf2ee] h-[60px] shrink-0 z-10">
                            <div className="flex items-center gap-3 min-w-0">
                                <button onClick={() => setSidebarVisible(true)} className="md:hidden text-[#0b6656] mr-1">
                                    <ChevronLeft size={24} />
                                </button>
                                {selectedContact.profileImage ? (
                                    <img 
                                        src={getDisplayableImageUrl(selectedContact.profileImage)} 
                                        alt={selectedContact.name} 
                                        className="w-10 h-10 rounded-full object-cover shrink-0" 
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-[#d2e0d7] flex items-center justify-center text-[#0b6656] text-sm font-bold shrink-0">
                                        {selectedContact.name.startsWith('+') ? <Phone size={18} /> : selectedContact.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <h2 className="text-[#111b21] font-medium text-[15px] truncate">{selectedContact.name}</h2>
                                    <p className="text-[#0b6656] text-[12px] truncate">{selectedContact.phone || 'Online'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-[#0b6656]">
                                <Search size={20} className="hidden sm:block" />
                                <MoreVertical size={20} />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 relative custom-scrollbar">
                            <div className="wa-bg" />

                            <div className="relative z-10 space-y-8 flex flex-col">
                                {groupedMessages.map((group) => (
                                    <React.Fragment key={group.date}>
                                        {/* Date Separator */}
                                        <div className="flex justify-center">
                                            <span className="bg-white text-[#667781] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border border-[#e9edef]">
                                                {group.label}
                                            </span>
                                        </div>

                                        <div className="flex flex-col">
                                            {group.messages.map((msg, index) => {
                                                const isIncoming = msg.direction === 'inbound' || msg.status === 'Received';
                                                const isFirstUnread = msg.is_read === false && isIncoming && group.messages.slice(0, index).every(m => m.is_read !== false);

                                                const prevMsg = index > 0 ? group.messages[index - 1] : null;
                                                const prevIsIncoming = prevMsg ? (prevMsg.direction === 'inbound' || prevMsg.status === 'Received') : null;
                                                const isConsecutive = prevMsg && (isIncoming === prevIsIncoming);

                                                const bubbleClasses = isIncoming
                                                    ? `bg-white text-[#111b21] border-[#e9edef] ${isConsecutive ? 'rounded-xl' : 'rounded-xl rounded-tl-none message-bubble-received'}`
                                                    : `bg-[#d9fdd3] text-[#111b21] border-[#d9fdd3]/20 ${isConsecutive ? 'rounded-xl' : 'rounded-xl rounded-tr-none message-bubble-sent'}`;

                                                const isPOText = msg.message_content && /^PO\s+.+?\s+issued to/i.test(String(msg.message_content).trim());
                                                const isTemplateMsg = msg.message_content?.startsWith("Template: ") || msg.message_type === 'purchase_po' || msg.message_type === 'Purchase Order' || msg.template_body || isPOText;
                                                const isDocMsg = msg.message_type === 'Document' || msg.message_content?.includes('[Document');

                                                const isPlainText = !msg.media_url && !isTemplateMsg && !isDocMsg;

                                                return (
                                                    <React.Fragment key={msg.id}>
                                                        {/* Unread Separator */}
                                                        {isFirstUnread && (
                                                            <div ref={unreadRef} className="flex justify-center my-4 animate-in fade-in duration-500">
                                                                <span className="bg-white text-[#00a884] text-[10px] font-bold px-4 py-1 rounded-full border border-[#00a884]/20 uppercase tracking-widest shadow-sm">
                                                                    Unread Messages Below
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`group flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${isIncoming ? 'items-start' : 'items-end'} ${isConsecutive ? 'mt-1' : index === 0 ? 'mt-2' : 'mt-4'} w-full`}
                                                        >
                                                            <div className={`flex items-center w-full relative ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                                                                {/* Outgoing Actions (Left of Bubble) */}
                                                                {!isIncoming && (
                                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 mr-2.5 transition-all shrink-0 z-20 relative">
                                                                        {/* Smile reaction outline */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id);
                                                                                setShowMoreReactionsMsgId(null);
                                                                            }}
                                                                            className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#54656f] hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                                                                        >
                                                                            <Smile size={15} />
                                                                        </button>

                                                                        {/* Quick Reaction Bar */}
                                                                        {activeReactionMsgId === msg.id && (
                                                                            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 mb-2 z-30 flex items-center bg-white shadow-xl border border-slate-200 rounded-full py-1.5 px-3 gap-2.5 animate-in zoom-in-95 duration-100">
                                                                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                                                    <button
                                                                                        key={emoji}
                                                                                        type="button"
                                                                                        onClick={() => handleReact(msg.id, emoji)}
                                                                                        className="hover:scale-125 transition-transform text-lg flex items-center justify-center cursor-pointer"
                                                                                    >
                                                                                        {emoji}
                                                                                    </button>
                                                                                ))}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setShowMoreReactionsMsgId(msg.id)}
                                                                                    className="hover:scale-125 transition-transform text-slate-500 hover:text-slate-800 text-lg flex items-center justify-center font-bold px-1 cursor-pointer"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {/* More Reactions Grid */}
                                                                        {showMoreReactionsMsgId === msg.id && (
                                                                            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 mb-2 z-40 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 w-[220px] h-[180px] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-100">
                                                                                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
                                                                                    <span className="text-[10px] font-bold text-slate-500">More Reactions</span>
                                                                                    <button type="button" onClick={() => setShowMoreReactionsMsgId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                                                                        <X size={12} />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="grid grid-cols-6 gap-2 text-base">
                                                                                    {["👏", "🙌", "🔥", "🎉", "🌟", "💡", "💯", "🎈", "🎂", "🚀", "👀", "🤝", "💔", "🤩", "🥳", "🥺", "😡", "🤔", "🤫", "👋", "✍️", "👑", "🎯", "✨"].map(emoji => (
                                                                                        <button
                                                                                            key={emoji}
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                handleReact(msg.id, emoji);
                                                                                                setShowMoreReactionsMsgId(null);
                                                                                            }}
                                                                                            className="hover:scale-125 transition-transform flex items-center justify-center cursor-pointer"
                                                                                        >
                                                                                            {emoji}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Bubble */}
                                                                <div className={`max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] p-2 px-3 rounded-xl shadow-md relative message-bubble border ${bubbleClasses}`}>
                                                                    {isPlainText ? (
                                                                        <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap pr-1">
                                                                            {msg.message_content}
                                                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#667781] float-right mt-2 ml-2 select-none whitespace-nowrap align-bottom">
                                                                                {formatMessageTime(msg.created_at)}
                                                                                {!isIncoming && renderStatusCheck(msg)}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col">
                                                                            <div className="text-[14px] leading-relaxed">
                                                                                {msg.media_url ? (
                                                                                    <div className="flex flex-col space-y-1">
                                                                                        {msg.message_type === 'Image' && (
                                                                                            msg.mime_type?.startsWith('video/') ? (
                                                                                                <video src={msg.media_url} controls className="rounded-lg max-h-[220px] w-full object-contain mb-1.5" />
                                                                                            ) : (
                                                                                                <img src={msg.media_url} alt="Media upload" className="rounded-lg max-h-[220px] w-auto object-contain cursor-pointer mb-1.5" onClick={() => window.open(msg.media_url, '_blank')} />
                                                                                            )
                                                                                        )}
                                                                                        {(msg.message_type === 'GIF' || msg.message_type === 'Sticker') && (
                                                                                            <img src={msg.media_url} alt="Animation or Sticker" className="rounded-lg max-h-[140px] w-auto object-contain mb-1" />
                                                                                        )}
                                                                                        {(msg.message_type === 'Document' || msg.mime_type === 'application/pdf' || msg.file_name || msg.message_content?.includes('[Document') || (msg.media_url && !['Image', 'GIF', 'Sticker'].includes(msg.message_type))) && (() => {
                                                                                            const rawFileName = msg.file_name || (msg.message_content?.match(/\[Document:\s*([^\]]+)\]/i)?.[1]) || 'Purchase_Order.pdf';
                                                                                            const ext = (rawFileName.split('.').pop() || 'PDF').toUpperCase().slice(0, 4);

                                                                                            return (
                                                                                                <a 
                                                                                                    href={msg.media_url || '#'} 
                                                                                                    target={msg.media_url ? "_blank" : "_self"}
                                                                                                    rel="noopener noreferrer"
                                                                                                    download={rawFileName}
                                                                                                    onClick={(e) => {
                                                                                                        if (!msg.media_url) {
                                                                                                            e.preventDefault();
                                                                                                            toast.info('Document file is not available for download');
                                                                                                        }
                                                                                                    }}
                                                                                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/5 hover:bg-black/10 border border-black/5 transition-all group/doc mb-1.5 min-w-[220px] max-w-full"
                                                                                                >
                                                                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                                                        {/* Document Badge (Red for PDF, Teal for others) */}
                                                                                                        <div className={`w-9 h-10 rounded-lg ${ext === 'PDF' ? 'bg-[#ea4335]' : 'bg-[#00a884]'} text-white flex flex-col items-center justify-center font-bold shadow-sm shrink-0 uppercase tracking-tighter`}>
                                                                                                            <FileText size={16} />
                                                                                                            <span className="text-[7.5px] leading-none font-black mt-0.5">{ext}</span>
                                                                                                        </div>

                                                                                                        {/* Document Info */}
                                                                                                        <div className="flex-1 min-w-0 text-left">
                                                                                                            <p className="text-[12.5px] font-semibold text-[#111b21] truncate leading-snug group-hover/doc:text-[#008069] transition-colors">
                                                                                                                {rawFileName}
                                                                                                            </p>
                                                                                                            <p className="text-[10px] text-[#667781] font-medium tracking-tight mt-0.5">
                                                                                                                {ext} Document
                                                                                                            </p>
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    {/* Circular Download Icon Button (WhatsApp Web Style) */}
                                                                                                    <div 
                                                                                                        className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#54656f] group-hover/doc:bg-[#00a884] group-hover/doc:text-white group-hover/doc:border-[#00a884] group-hover/doc:scale-110 transition-all shrink-0 cursor-pointer"
                                                                                                        title="Download Document"
                                                                                                    >
                                                                                                        <Download size={15} />
                                                                                                    </div>
                                                                                                </a>
                                                                                            );
                                                                                        })()}
                                                                                        {/* Caption / Text content */}
                                                                                        {msg.message_content && !msg.message_content.startsWith('[Media File]:') && !msg.message_content.startsWith('[Document File]:') && !msg.message_content.startsWith('[GIF message]') && !msg.message_content.startsWith('[Sticker message]') && !msg.message_content.startsWith('[Document:') && (
                                                                                            <div className="text-[13px] whitespace-pre-wrap">
                                                                                                {(msg.message_content.startsWith('Template: ') || msg.template_body || msg.message_type === 'purchase_po' || msg.message_type === 'Purchase Order') ? formatTemplateMessage(msg) : msg.message_content}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    formatTemplateMessage(msg)
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781] mt-1 select-none self-end">
                                                                                <span>{formatMessageTime(msg.created_at)}</span>
                                                                                {!isIncoming && renderStatusCheck(msg)}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Reacted Emoji Badge */}
                                                                    {reactions[msg.id] && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setShowReactionDetailsMsgId(showReactionDetailsMsgId === msg.id ? null : msg.id);
                                                                                }}
                                                                                className="absolute -bottom-2 right-4 bg-white border border-slate-200 shadow-sm rounded-full px-1.5 py-0.5 text-[12px] flex items-center justify-center select-none z-10 animate-in zoom-in-50 duration-200 cursor-pointer hover:bg-slate-50 hover:scale-105 active:scale-95 transition-transform"
                                                                            >
                                                                                {reactions[msg.id]}
                                                                            </button>

                                                                            {/* Reaction Details Popup (appears near message bubble) */}
                                                                            {showReactionDetailsMsgId === msg.id && (() => {
                                                                                const reactionEmoji = reactions[msg.id];
                                                                                const userProfileImg = localStorage.getItem("profile_image");
                                                                                
                                                                                return (
                                                                                    <>
                                                                                        {/* Transparent backdrop so BG doesn't get muted */}
                                                                                        <div 
                                                                                            className="fixed inset-0 z-30 bg-transparent cursor-default"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setShowReactionDetailsMsgId(null);
                                                                                            }}
                                                                                        />
                                                                                        <div 
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                            className={`absolute top-full ${isIncoming ? 'left-0' : 'right-0'} mt-2 z-40 bg-white rounded-2xl shadow-2xl w-[300px] sm:w-[320px] flex flex-col p-4 border border-slate-100 animate-in zoom-in-95 duration-100 text-left`}
                                                                                        >
                                                                                            {/* Tabs */}
                                                                                            <div className="flex border-b border-slate-100 pb-1 text-sm font-semibold text-slate-500">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="pb-2 px-3 border-b-[3px] border-[#008069] text-[#008069] flex items-center gap-1.5 focus:outline-none font-bold"
                                                                                                >
                                                                                                    All <span className="text-[11px] bg-[#e1f3ec] text-[#008069] px-1.5 py-0.5 rounded-full font-bold">1</span>
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="pb-2 px-3 text-[#54656f] flex items-center gap-1.5 focus:outline-none"
                                                                                                >
                                                                                                    <span>{reactionEmoji}</span> 
                                                                                                    <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">1</span>
                                                                                                </button>
                                                                                            </div>

                                                                                            {/* User Row / List of Reacted Users */}
                                                                                            <div 
                                                                                                onClick={() => {
                                                                                                    handleReact(msg.id, reactionEmoji);
                                                                                                    setShowReactionDetailsMsgId(null);
                                                                                                }}
                                                                                                className="flex items-center justify-between py-3 px-1 mt-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                                                                                            >
                                                                                                <div className="flex items-center gap-3">
                                                                                                    {userProfileImg ? (
                                                                                                        <img 
                                                                                                            src={getDisplayableImageUrl(userProfileImg)} 
                                                                                                            alt="You" 
                                                                                                            className="w-10 h-10 rounded-full object-cover shrink-0" 
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <div className="w-10 h-10 rounded-full bg-[#d2e0d7] flex items-center justify-center text-[#0b6656] text-sm font-bold shrink-0">
                                                                                                            <User size={20} />
                                                                                                        </div>
                                                                                                    )}
                                                                                                    <div className="text-left">
                                                                                                        <p className="text-sm font-semibold text-[#111b21]">You</p>
                                                                                                        <p className="text-[11px] text-slate-400 group-hover:text-red-500 transition-colors">Click to remove</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="text-xl px-1 hover:scale-125 transition-transform">
                                                                                                    {reactionEmoji}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Incoming Actions (Right of Bubble) */}
                                                                {isIncoming && (
                                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 ml-2.5 transition-all shrink-0 z-20 relative">
                                                                        {/* Forward button (Today + Inbound only) */}
                                                                        {isIncoming && isToday(msg.created_at) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setForwardingMsg(msg)}
                                                                                className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#54656f] hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                                                                                title="Forward message"
                                                                            >
                                                                                <CornerUpRight size={15} />
                                                                            </button>
                                                                        )}

                                                                        {/* Smile reaction outline */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id);
                                                                                setShowMoreReactionsMsgId(null);
                                                                            }}
                                                                            className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#54656f] hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                                                                        >
                                                                            <Smile size={15} />
                                                                        </button>

                                                                        {/* Quick Reaction Bar */}
                                                                        {activeReactionMsgId === msg.id && (
                                                                            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 z-30 flex items-center bg-white shadow-xl border border-slate-200 rounded-full py-1.5 px-3 gap-2.5 animate-in zoom-in-95 duration-100">
                                                                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                                                    <button
                                                                                        key={emoji}
                                                                                        type="button"
                                                                                        onClick={() => handleReact(msg.id, emoji)}
                                                                                        className="hover:scale-125 transition-transform text-lg flex items-center justify-center cursor-pointer"
                                                                                    >
                                                                                        {emoji}
                                                                                    </button>
                                                                                ))}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setShowMoreReactionsMsgId(msg.id)}
                                                                                    className="hover:scale-125 transition-transform text-slate-500 hover:text-slate-800 text-lg flex items-center justify-center font-bold px-1 cursor-pointer"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {/* More Reactions Grid */}
                                                                        {showMoreReactionsMsgId === msg.id && (
                                                                            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 z-40 bg-white border border-[#d1d7db] shadow-2xl rounded-xl p-3 w-[220px] h-[180px] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-100">
                                                                                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
                                                                                    <span className="text-[10px] font-bold text-slate-500">More Reactions</span>
                                                                                    <button type="button" onClick={() => setShowMoreReactionsMsgId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                                                                        <X size={12} />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="grid grid-cols-6 gap-2 text-base">
                                                                                    {["👏", "🙌", "🔥", "🎉", "🌟", "💡", "💯", "🎈", "🎂", "🚀", "👀", "🤝", "💔", "🤩", "🥳", "🥺", "😡", "🤔", "🤫", "👋", "✍️", "👑", "🎯", "✨"].map(emoji => (
                                                                                        <button
                                                                                            key={emoji}
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                handleReact(msg.id, emoji);
                                                                                                setShowMoreReactionsMsgId(null);
                                                                                            }}
                                                                                            className="hover:scale-125 transition-transform flex items-center justify-center cursor-pointer"
                                                                                        >
                                                                                            {emoji}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </React.Fragment>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                        </div>

                        {/* Chat Footer / Input Area */}
                        <form onSubmit={handleSendMessage} className="px-4 py-2 bg-[#ebf2ee] flex items-center gap-3 h-[62px] shrink-0 relative">
                            {/* Hidden Inputs for File Selection */}
                            <input 
                                type="file" 
                                ref={mediaInputRef} 
                                className="hidden" 
                                accept="image/*,video/*" 
                                onChange={handleMediaChange} 
                            />
                            <input 
                                type="file" 
                                ref={docInputRef} 
                                className="hidden" 
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" 
                                onChange={handleDocChange} 
                            />

                            {/* Emoji/GIF/Sticker Panel */}
                            {showEmojiPanel && (
                                <div className="absolute bottom-[70px] left-14 z-50 bg-white border border-[#d1d7db] shadow-xl rounded-xl w-[320px] h-[340px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
                                    {/* Tabs Header */}
                                    <div className="flex bg-[#f0f2f5] border-b border-[#d1d7db] text-[13px] font-semibold text-[#54656f]">
                                        <button 
                                            type="button"
                                            onClick={() => setActiveEmojiTab('emoji')}
                                            className={`flex-1 py-2 text-center transition-colors ${activeEmojiTab === 'emoji' ? 'bg-white text-[#00a884] border-b-2 border-[#00a884]' : 'hover:bg-black/5'}`}
                                        >
                                            Emoji
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setActiveEmojiTab('gif')}
                                            className={`flex-1 py-2 text-center transition-colors ${activeEmojiTab === 'gif' ? 'bg-white text-[#00a884] border-b-2 border-[#00a884]' : 'hover:bg-black/5'}`}
                                        >
                                            GIF
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setActiveEmojiTab('sticker')}
                                            className={`flex-1 py-2 text-center transition-colors ${activeEmojiTab === 'sticker' ? 'bg-white text-[#00a884] border-b-2 border-[#00a884]' : 'hover:bg-black/5'}`}
                                        >
                                            Sticker
                                        </button>
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white">
                                        {activeEmojiTab === 'emoji' && (
                                            <div className="grid grid-cols-8 gap-2 text-2xl">
                                                {emojiList.map((emoji, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => appendEmoji(emoji)}
                                                        className="hover:scale-125 transition-transform flex items-center justify-center"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {activeEmojiTab === 'gif' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                {gifList.map((gif, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => sendGifOrSticker(gif.url, 'gif')}
                                                        className="group relative rounded-lg overflow-hidden border border-black/5 hover:border-[#00a884] transition-colors"
                                                    >
                                                        <img src={gif.url} alt={gif.name} className="w-full h-24 object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
                                                            Send
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {activeEmojiTab === 'sticker' && (
                                            <div className="grid grid-cols-3 gap-3">
                                                {stickerList.map((stk, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => sendGifOrSticker(stk.url, 'sticker')}
                                                        className="group p-2 rounded-lg border border-black/5 hover:border-[#00a884] hover:bg-black/5 transition-all flex items-center justify-center"
                                                    >
                                                        <img src={stk.url} alt={stk.name} className="w-12 h-12 object-contain" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Attach (+) Panel */}
                            {showAttachPanel && (
                                <div className="absolute bottom-[70px] left-4 z-50 bg-white border border-[#d1d7db] shadow-xl rounded-xl py-2 w-[200px] flex flex-col animate-in slide-in-from-bottom-5 duration-200">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            docInputRef.current?.click();
                                            setShowAttachPanel(false);
                                        }}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors w-full text-left"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-[#1e88e5] text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <FileText size={18} />
                                        </div>
                                        <span className="text-[14px] text-[#111b21] font-semibold">Document</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            mediaInputRef.current?.click();
                                            setShowAttachPanel(false);
                                        }}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors w-full text-left"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-[#7b1fa2] text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <ImageIcon size={18} />
                                        </div>
                                        <span className="text-[14px] text-[#111b21] font-semibold">Photos & videos</span>
                                    </button>
                                </div>
                            )}

                            {/* Attach (+) Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAttachPanel(!showAttachPanel);
                                    setShowEmojiPanel(false);
                                }}
                                className="p-1.5 hover:bg-[#d2e0d7] rounded-full text-[#0b6656] transition-colors shrink-0"
                            >
                                <Plus size={24} />
                            </button>

                            {/* Emoji Icon Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEmojiPanel(!showEmojiPanel);
                                    setShowAttachPanel(false);
                                }}
                                className="p-1.5 hover:bg-[#d2e0d7] rounded-full text-[#0b6656] transition-colors shrink-0"
                            >
                                <Smile size={22} />
                            </button>

                            <div className="flex-1">
                                <input
                                    type="text"
                                    ref={textInputRef}
                                    placeholder="Type a message"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="w-full h-10 bg-white border-none rounded-lg px-4 text-[#111b21] text-sm focus:outline-none placeholder-[#667781]"
                                    disabled={sending}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || sending}
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${newMessage.trim() && !sending ? 'bg-[#00a884] text-white shadow-lg' : 'bg-transparent text-[#0b6656]'
                                    }`}
                            >
                                <Send size={20} className={newMessage.trim() ? 'translate-x-0.5' : ''} />
                            </button>
                        </form>

                        {/* File Upload Preview Modal */}
                        {selectedFile && (
                            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-[16px] font-bold text-[#111b21]">
                                            Send {fileType === 'media' ? 'Photo / Video' : 'Document'}
                                        </h3>
                                        <button type="button" onClick={cancelFileSend} className="text-[#667781] hover:text-[#111b21]">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Preview Area */}
                                    <div className="flex-1 py-4 flex flex-col items-center justify-center">
                                        {fileType === 'media' && filePreviewUrl ? (
                                            selectedFile.type.startsWith('video/') ? (
                                                <video src={filePreviewUrl} controls className="max-h-[200px] w-auto rounded-lg object-contain border border-slate-100 shadow-sm" />
                                            ) : (
                                                <img src={filePreviewUrl} alt="Upload preview" className="max-h-[200px] w-auto rounded-lg object-contain border border-slate-100 shadow-sm" />
                                            )
                                        ) : (
                                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3 w-full">
                                                <div className="w-12 h-12 rounded bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <p className="text-sm font-medium text-[#111b21] truncate">{selectedFile.name}</p>
                                                    <p className="text-xs text-[#667781] uppercase font-bold">
                                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Caption Input */}
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="Add a caption..." 
                                            value={fileCaption}
                                            onChange={(e) => setFileCaption(e.target.value)}
                                            className="w-full h-11 border border-slate-200 rounded-lg px-4 text-sm text-[#111b21] focus:outline-none focus:border-[#00a884] placeholder-slate-400"
                                            disabled={uploadingFile}
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={cancelFileSend}
                                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-[#54656f] font-semibold transition-colors"
                                            disabled={uploadingFile}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={sendFileMessage}
                                            className="px-5 py-2 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-sm font-semibold transition-all shadow-md flex items-center gap-2"
                                            disabled={uploadingFile}
                                        >
                                            {uploadingFile ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                'Send'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Forwarding Modal */}
                        {forwardingMsg && (
                            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col p-5 space-y-4 animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-[16px] font-bold text-[#111b21]">
                                            Forward Message
                                        </h3>
                                        <button type="button" onClick={() => setForwardingMsg(null)} className="text-[#667781] hover:text-[#111b21] cursor-pointer">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Search Contact */}
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667781] flex items-center">
                                            <Search size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search contact..."
                                            value={forwardSearch}
                                            onChange={(e) => setForwardSearch(e.target.value)}
                                            className="w-full h-9 pl-9 pr-4 bg-[#f0f2f5] border-none rounded-lg text-[#111b21] text-xs focus:outline-none placeholder-[#667781]"
                                        />
                                    </div>

                                    {/* Contacts List */}
                                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                        {contacts
                                            .filter(c => 
                                                c.name.toLowerCase().includes(forwardSearch.toLowerCase()) || 
                                                c.phone?.includes(forwardSearch)
                                            )
                                            .map(c => (
                                                <div key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {c.profileImage ? (
                                                            <img 
                                                                src={getDisplayableImageUrl(c.profileImage)} 
                                                                alt={c.name} 
                                                                className="w-8 h-8 rounded-full object-cover shrink-0" 
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-[#d2e0d7] flex items-center justify-center text-[#0b6656] text-xs font-bold shrink-0">
                                                                {c.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-[#111b21] truncate">{c.name}</p>
                                                            <p className="text-[10px] text-[#667781] truncate">{c.phone}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleForwardMessage(c, forwardingMsg);
                                                            setForwardingMsg(null);
                                                        }}
                                                        className="px-3 py-1 bg-[#00a884] hover:bg-[#008f70] text-white rounded-md text-[11px] font-bold shadow-sm transition-all shrink-0 cursor-pointer"
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reaction Details Modal */}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#f8f9fa] text-center p-12 relative">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 bg-[#d2e0d7] rounded-full flex items-center justify-center text-[#0b6656]">
                                <Send size={48} />
                            </div>
                        </div>
                        <h1 className="text-3xl font-light text-[#41525d] mb-3">WhatsApp Web</h1>
                        <p className="text-sm text-[#667781] max-w-sm leading-relaxed">
                            Select a conversation to view detailed message logs and audit your automated communications.
                        </p>
                        <div className="absolute bottom-8 flex items-center gap-2 text-[#667781] text-sm">
                            <Clock size={14} /> End-to-end encrypted
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsappHistory;
