"use client"

import { useAdmin } from '@/app/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  ShieldCheck,
  FileText,
  RefreshCw,
  Layers,
  Link as LinkIcon,
  AlertCircle,
  Copy,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  X,
  Search,
  Mail,
  MailWarning,
  MessageSquare
} from 'lucide-react'

function formatDateMMDDYYYY(input: Date | string | number, timeZone?: string): string {
  const isBareIsoDate = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input);
  const date = input instanceof Date ? input : new Date(isBareIsoDate ? `${input}T12:00:00` : input);
  if (isNaN(date.getTime())) return String(input);
  return date.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatEventLabel(event: string): string {
  return String(event)
    .split('_')
    .filter(Boolean)
    .map((word) => (word.toLowerCase() === 'otp' ? 'OTP' : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Adds whole days to a 'YYYY-MM-DD' key and returns a 'YYYY-MM-DD' key (calendar math in UTC
 *  noon so DST shifts can't move the result by a day). */
function addDaysToDateKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}


/** Delivery states reported by Resend. Anything red means the customer did not get the email. */
const DELIVERY_STATUS_STYLE: Record<string, string> = {
  delivered:  'bg-green-50 text-green-700 border-green-200',
  sent:       'bg-blue-50 text-blue-700 border-blue-200',
  accepted:   'bg-zinc-100 text-zinc-600 border-zinc-200',
  delayed:    'bg-amber-50 text-amber-700 border-amber-200',
  bounced:    'bg-red-50 text-red-700 border-red-200',
  complained: 'bg-red-50 text-red-700 border-red-200',
  rejected:   'bg-red-50 text-red-700 border-red-200',
  failed:     'bg-red-50 text-red-700 border-red-200',
}

const FAILURE_DELIVERY_STATUSES = new Set(['bounced', 'complained', 'rejected', 'failed'])

/** Postal appends "Recipient removed from suppression list" to nearly every successful send's
 *  detail text unconditionally (confirmed against its own worker logs — it fires even seconds
 *  apart with no bounce in between), not just when a row was genuinely removed. Stripped here
 *  since it reads as an alarming event but is really just Postal's own internal bookkeeping. */
function cleanDeliveryDetail(detail?: string): string {
  if (!detail) return ''
  return detail.replace(/\.?\s*Recipient (removed from|added to) suppression list[^.]*\.?/gi, '').trim()
}

/** Turns a provider's technical failure text (itWALK error codes, Postal SMTP messages) into
 *  a plain-English reason an admin can act on — "bounced" alone doesn't say whether the
 *  address is wrong, the domain is a typo, or the recipient's server is just refusing us.
 *  Matched on the raw detail, before cleanDeliveryDetail strips Postal's suppression note. */
function explainDeliveryFailure(status?: string, rawDetail?: string): string {
  const d = rawDetail || ''
  if (/is on the suppression list/i.test(d)) {
    return 'Skipped — this address failed repeatedly before, so it is on the block list.'
  }
  if (/6037|domain mx not found|no smtp servers were available|no hosts to try|nxdomain/i.test(d)) {
    return 'The domain has no mail server — the email address is most likely misspelled.'
  }
  if (/6006|recipient address is invalid|user unknown|no such user|does not exist|mailbox (not found|unavailable)|address rejected/i.test(d)) {
    return "This email address doesn't exist (invalid mailbox)."
  }
  if (/mailbox full|over quota|quota exceeded/i.test(d)) {
    return "The recipient's mailbox is full."
  }
  if (/spam|blacklist|blocklist|reputation|policy/i.test(d)) {
    return "Blocked by the recipient's mail server (spam or policy filter)."
  }
  if (/6012|permanent (smtp )?delivery error/i.test(d)) {
    return "The recipient's mail server permanently refused it — the address is probably invalid or blocked."
  }
  if (status === 'bounced' || status === 'failed') {
    return 'Permanently rejected — the address is most likely wrong (the provider gave no further detail).'
  }
  return ''
}

const PROVIDER_STYLE: Record<string, string> = {
  postal:     'bg-purple-50 text-purple-700 border-purple-200',
  msg91:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  itwalk:     'bg-cyan-50 text-cyan-700 border-cyan-200', // historical rows only — provider removed 2026-10-15
  postmark:   'bg-orange-50 text-orange-700 border-orange-200',
  zeptomail:  'bg-teal-50 text-teal-700 border-teal-200',
  maileroo:   'bg-pink-50 text-pink-700 border-pink-200',
  mailersend: 'bg-lime-50 text-lime-700 border-lime-200',
  mailpace:   'bg-sky-50 text-sky-700 border-sky-200',
}

const DELIVERY_STATUS_HINT: Record<string, string> = {
  accepted:   'The provider accepted the message — this does NOT confirm delivery. A send can still fail after this point (rejected, bounced, or silently blocked) without ever changing this status, depending on the provider and whether its webhook is configured.',
  sent:       'Handed off to the receiving mail server.',
  delivered:  'The receiving server accepted it.',
  delayed:    'Temporarily deferred — the provider is still retrying.',
  bounced:    'Permanently rejected. The address is usually wrong.',
  complained: 'Marked as spam by the recipient.',
  rejected:   'The provider refused the send outright — it never left.',
  failed:     'Delivery failed.',
}

function getTodayDateString(timeZone: string): string {
  return formatDateKeyInTimeZone(new Date(), timeZone);
}

function maskMmDdYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return mm;
  if (digits.length <= 4) return `${mm}/${dd}`;
  return `${mm}/${dd}/${yyyy}`;
}

function parseMmDdYyyy(display: string): string | null {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() + 1 !== Number(mm) || d.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function isoToMmDdYyyy(iso: string): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${mm}/${dd}/${yyyy}`;
}

function DateFilterInput({ value, onChange, maxIso, className, required }: { value: string, onChange: (iso: string) => void, maxIso?: string, className?: string, required?: boolean }) {
  const [display, setDisplay] = useState(isoToMmDdYyyy(value));

  useEffect(() => {
    setDisplay(isoToMmDdYyyy(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="mm/dd/yyyy"
      value={display}
      onChange={(e) => {
        const masked = maskMmDdYyyyInput(e.target.value);
        setDisplay(masked);
        if (masked === '') {
          e.target.setCustomValidity('');
          onChange('');
          return;
        }
        const parsed = parseMmDdYyyy(masked);
        if (required) e.target.setCustomValidity(parsed ? '' : 'Enter a full date as mm/dd/yyyy');
        if (parsed) onChange(maxIso && parsed > maxIso ? maxIso : parsed);
      }}
      required={required}
      className={className}
    />
  );
}

export default function QuickBooksPaymentLinkCreator() {
  const [users, setUsers] = useState(1)
  const [totalPrice, setTotalPrice] = useState('')
  const [selectedEdition, setSelectedEdition] = useState('silver')
  const [selectedYears, setSelectedYears] = useState(1)
  const [discountAmount, setDiscountAmount] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [selectedGateway, setSelectedGateway] = useState<'authorize' | 'online' | 'stripe' | 'antom' | 'shopify' | 'mor' | 'paydollar'>('shopify')

  const [activeTab, setActiveTab] = useQueryState(
    'tab',
    parseAsStringLiteral(['create', 'logs', 'email', 'sentEmails'] as const)
      .withDefault('create')
      .withOptions({ history: 'replace', clearOnDefault: true })
  )

  const [logs, setLogs] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [filterMode, setFilterMode] = useState<'All' | 'Test'>('All')
  const [selectedLog, setSelectedLog] = useState<any>(null)

  const [advGateway, setAdvGateway] = useState('All')
  const [advStatus, setAdvStatus] = useState('All')
  const [advAmount, setAdvAmount] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [advDateFrom, setAdvDateFrom] = useState('')
  const [advDateTo, setAdvDateTo] = useState('')
  const [logsPerPage, setLogsPerPage] = useState(10)

  /** How recently a prior send to the same address counts as a likely duplicate. */
  const BULK_HISTORY_DANGER_MS = 7 * 24 * 60 * 60 * 1000

  // Send Email tab state
  const [emailType, setEmailType] = useState<'success' | 'failed' | 'refund' | 'survey' | 'query'>('success')
  const [emailForm, setEmailForm] = useState({
    toEmail: '',
    customerName: '',
    companyName: '',
    orderId: '',
    planDetails: '',
    paymentMethodLabel: '',
    licenseNumber: '',
    productNumber: '',
    amountUSD: '',
    paidAt: getTodayDateString('America/New_York'),
    amountDueUSD: '',
    // Reminder defaults: due today, cancellation a week after the due date. Dates are US
    // Eastern like everywhere else on this dashboard.
    cancellationDate: addDaysToDateKey(getTodayDateString('America/New_York'), 7),
    dueDate: getTodayDateString('America/New_York'),
    // Receipt's optional "Due date" (next billing) — the typical subscription cycle, a month out.
    receiptDueDate: addDaysToDateKey(getTodayDateString('America/New_York'), 30),
    refundAmountUSD: '',
    refundedAt: getTodayDateString('America/New_York'),
    refundReason: '',
    // "Query" tab — a free-form message, admin-written subject + body, no NPS scoring.
    queryTitle: '',
    queryBody: '',
  })
  const [isSendingCustomEmail, setIsSendingCustomEmail] = useState(false)
  const [reminderGateway, setReminderGateway] = useState<'' | 'authorize' | 'stripe' | 'shopify' | 'shopifySubscription' | 'paydollar'>('')
  const [emailSubscriptionTier, setEmailSubscriptionTier] = useState('49.87')
  const EMAIL_SUBSCRIPTION_TIERS = ['49.87', '98.78', '149.10', '198.70', '298.00', '349.89']
  const [planDetailsIsCustom, setPlanDetailsIsCustom] = useState(false)
  /** Same prior-send check as the bulk tab, but for one recipient — caught before the send,
   *  not just visible after in Sent Emails. Keyed off toEmail + emailType so it re-checks
   *  when either changes. */
  const [singleSendPrior, setSingleSendPrior] = useState<{ label: string; isRecent: boolean } | null>(null)
  const [isCheckingSingleHistory, setIsCheckingSingleHistory] = useState(false)
  const [singleDuplicateConfirming, setSingleDuplicateConfirming] = useState(false)
  /** Domain-level MX check for the single-recipient form — flags an address like
   *  "ap@pchtechnoloies.com" (a typo, zero mail servers) before the admin even clicks Send,
   *  instead of finding out minutes later from a provider bounce. */
  const [singleEmailDomainInvalid, setSingleEmailDomainInvalid] = useState<string | null>(null)

  // Sent Emails history (emailLogs collection). Paginated server-side — at a few hundred
  // sends a day the table would otherwise only ever show the newest fraction of one day.
  const [emailLogsList, setEmailLogsList] = useState<any[]>([])
  const [emailLogsTotal, setEmailLogsTotal] = useState(0)
  const [isLoadingEmailLogs, setIsLoadingEmailLogs] = useState(false)
  const [selectedEmailLog, setSelectedEmailLog] = useState<any>(null)
  /** Click-to-open detail for a delivery status badge. Fixed-positioned from the click's own
   *  coordinates because the table sits in an overflow-x-auto wrapper that would clip an
   *  absolutely-positioned popover. */
  const [statusPopover, setStatusPopover] = useState<{ entry: any; top: number; left: number } | null>(null)
  const [emailLogsPage, setEmailLogsPage] = useState(1)
  const [emailLogsSearch, setEmailLogsSearch] = useState('')
  const [emailLogsTrigger, setEmailLogsTrigger] = useState('') // '' = all triggers
  const [emailLogsType, setEmailLogsType] = useState('') // '' = all email types
  const [emailLogsDateFrom, setEmailLogsDateFrom] = useState('') // 'YYYY-MM-DD' or ''
  const [emailLogsDateTo, setEmailLogsDateTo] = useState('') // 'YYYY-MM-DD' or ''
  const [emailLogsPerPage, setEmailLogsPerPage] = useState(20)

  const editions = [
    { name: 'Silver', value: 'silver' },
    { name: 'Gold', value: 'gold' },
    { name: 'Platinum', value: 'platinum' },
    { name: 'Diamond', value: 'diamond' },
    { name: 'FSP', value: 'fsp' }
  ]

  const customProducts = [
    { name: 'Strategic Mobile Consulting', value: 'a' },
    { name: 'Mobile Application Porting', value: 'b' },
    { name: 'Technology Outsourcing', value: 'c' },
    { name: 'UI/UX Design', value: 'd' },
    { name: 'Ecommerce App Development', value: 'e' },
    { name: 'Startup app development', value: 'f' },
    { name: 'Custom CRM Development', value: 'g' },
    { name: 'SaaS App Development', value: 'h' },
    { name: 'Offshore Development Center', value: 'i' },
    { name: 'Product Engineering Services', value: 'j' },
    { name: 'IT Staff Augmentation', value: 'k' },
    { name: 'Dedicated Development Team', value: 'l' },
    { name: 'QuickBooks Payroll (Monthly Subscription)', value: 'm' },
    { name: 'Outstanding Balance Payment', value: 'n' }
  ]

  const [emailProductCode, setEmailProductCode] = useState('silver')
  const [emailUsers, setEmailUsers] = useState(1)
  const [emailYears, setEmailYears] = useState(1)
  const isEmailProductQbEdition = ['silver', 'gold', 'platinum', 'diamond', 'fsp'].includes(emailProductCode)

  const emailProductDisplayName = (() => {
    if (isEmailProductQbEdition) {
      const e = editions.find(ed => ed.value === emailProductCode)
      return `QuickBooks Enterprise ${e?.name || 'Silver'} Edition`
    }
    return customProducts.find(p => p.value === emailProductCode)?.name || ''
  })()

  const updateEmailForm = (field: string, value: string) => {
    setEmailForm(prev => ({ ...prev, [field]: value }))
  }

  // Keep the email's displayed "Plan / Product Details" text in sync with
  // the selected product, unless the admin has switched to custom text.
  useEffect(() => {
    if (!planDetailsIsCustom) {
      updateEmailForm('planDetails', emailProductDisplayName)
    }
  }, [emailProductCode, planDetailsIsCustom, emailProductDisplayName])

  // Shopify Subscription only offers the fixed Payroll tiers — lock the
  // product to PAYROLL and the amount to the selected tier so the link
  // always points at a real, working subscription checkout.
  useEffect(() => {
    if (reminderGateway === 'shopifySubscription') {
      setEmailProductCode('m')
      setPlanDetailsIsCustom(false)
      updateEmailForm('amountDueUSD', emailSubscriptionTier)
    }
  }, [reminderGateway, emailSubscriptionTier])

  // Builds the same encoded link the Payment Links tab produces — the QB
  // edition format (needs users/years) or the plain service-code format —
  // so "Update now" opens a real, working checkout for this exact amount,
  // product, and gateway.
  const buildUpdateLink = (amountUSD: number, gateway: 'authorize' | 'stripe' | 'shopify' | 'shopifySubscription' | 'paydollar') => {
    const gatewayFlag = gateway === 'authorize' ? 'GA' : gateway === 'stripe' ? 'GT' : gateway === 'shopifySubscription' ? 'GSHS' : gateway === 'paydollar' ? 'GPD' : 'GSH'
    const tStr = Math.round(amountUSD * 100).toString(36)

    let paymentString: string
    if (isEmailProductQbEdition) {
      const editionMap: Record<string, string> = { silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', fsp: 'F' }
      const shortEdition = editionMap[emailProductCode] || 'S'
      const uStr = emailUsers.toString(36)
      const yStr = emailYears.toString(36)
      paymentString = `${uStr}${shortEdition}${yStr}K0M${tStr}${gatewayFlag}`
    } else {
      paymentString = `S${emailProductCode}K0M${tStr}${gatewayFlag}`
    }

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const base = isLocalhost ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin)
    return `${base}/invoice/${paymentString}`
  }
  /** Debounced prior-send check for the single-recipient form — re-runs whenever the
   *  recipient or email type changes, same 7-day danger window as the bulk tab. */
  useEffect(() => {
    setSingleDuplicateConfirming(false)
    const email = emailForm.toEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSingleSendPrior(null)
      return
    }

    const handle = setTimeout(async () => {
      setIsCheckingSingleHistory(true)
      try {
        const stored = localStorage.getItem('adminAuth')
        const passwordHash = stored ? JSON.parse(stored).passwordHash : ''
        const res = await fetch('/api/admin/bulk-email-history', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${passwordHash}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: [email], type: emailType === 'success' ? 'receipt' : emailType === 'refund' ? 'refund' : 'reminder' }),
        })
        const data = await res.json()
        const sentAt = res.ok ? data.history?.[email.toLowerCase()] : undefined
        if (!sentAt) { setSingleSendPrior(null); return }
        const sentDate = new Date(sentAt)
        if (isNaN(sentDate.getTime())) { setSingleSendPrior(null); return }
        const isRecent = Date.now() - sentDate.getTime() < BULK_HISTORY_DANGER_MS
        const label = formatDateMMDDYYYY(sentDate) + ', ' + sentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        setSingleSendPrior({ label, isRecent })
      } catch {
        setSingleSendPrior(null)
      } finally {
        setIsCheckingSingleHistory(false)
      }
    }, 500)

    return () => clearTimeout(handle)
  }, [emailForm.toEmail, emailType])

  /** Debounced MX check for the single-recipient form — same DNS check sendEmail() itself
   *  runs, just surfaced here before the admin clicks Send rather than after. */
  useEffect(() => {
    const email = emailForm.toEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSingleEmailDomainInvalid(null)
      return
    }

    const handle = setTimeout(async () => {
      try {
        const stored = localStorage.getItem('adminAuth')
        const passwordHash = stored ? JSON.parse(stored).passwordHash : ''
        const res = await fetch(`/api/admin/check-email-domain?email=${encodeURIComponent(email)}`, {
          headers: { 'Authorization': `Bearer ${passwordHash}` },
        })
        const data = await res.json()
        setSingleEmailDomainInvalid(res.ok && data.valid === false ? (data.reason || 'This domain cannot receive email') : null)
      } catch {
        setSingleEmailDomainInvalid(null)
      }
    }, 500)

    return () => clearTimeout(handle)
  }, [emailForm.toEmail])

  const sendCustomEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    // A recent duplicate needs an explicit second click — the submit button is swapped
    // for a "send it again anyway?" confirmation instead of sending straight through.
    if (singleSendPrior?.isRecent && !singleDuplicateConfirming) {
      setSingleDuplicateConfirming(true)
      return
    }
    setIsSendingCustomEmail(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const payload: any = {
        type: emailType,
        toEmail: emailForm.toEmail,
        customerName: emailForm.customerName,
        companyName: emailForm.companyName,
        orderId: emailForm.orderId,
        planDetails: emailForm.planDetails,
        paymentMethodLabel: emailForm.paymentMethodLabel,
      }

      if (isEmailProductQbEdition) {
        payload.numUsers = emailUsers
        payload.contractYears = emailYears
      }

      if (emailType === 'success') {
        payload.amountUSD = emailForm.amountUSD
        payload.paidAt = emailForm.paidAt
        payload.licenseNumber = emailForm.licenseNumber
        payload.productNumber = emailForm.productNumber
        payload.dueDate = emailForm.receiptDueDate
      } else if (emailType === 'refund') {
        payload.refundAmountUSD = emailForm.refundAmountUSD
        payload.refundedAt = emailForm.refundedAt
        payload.reason = emailForm.refundReason
      } else if (emailType === 'failed') {
        payload.amountDueUSD = emailForm.amountDueUSD
        payload.cancellationDate = emailForm.cancellationDate
        payload.dueDate = emailForm.dueDate
        if (reminderGateway && emailForm.amountDueUSD) {
          payload.updateUrl = buildUpdateLink(Number(emailForm.amountDueUSD), reminderGateway)
        }
      } else if (emailType === 'query') {
        payload.subject = emailForm.queryTitle
        payload.bodyText = emailForm.queryBody
        // Query emails have no product picker — don't send the hidden Product state (defaults to Silver).
        delete payload.planDetails
        delete payload.numUsers
        delete payload.contractYears
      }

      const response = await fetch('/api/admin/send-custom-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Send failed')
      }

      toast.success(emailType === 'success' ? 'Receipt email sent!' : emailType === 'refund' ? 'Refund email sent!' : emailType === 'survey' ? 'Survey email sent!' : emailType === 'query' ? 'Message sent!' : 'Payment reminder sent!')
      setSingleDuplicateConfirming(false)
      fetchEmailLogs()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to send email')
    } finally {
      setIsSendingCustomEmail(false)
    }
  }

  const fetchEmailLogs = async (page?: number) => {
    const targetPage = page ?? emailLogsPage
    setIsLoadingEmailLogs(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const params = new URLSearchParams({ page: String(targetPage), limit: String(emailLogsPerPage) })
      if (emailLogsSearch.trim()) params.set('q', emailLogsSearch.trim())
      if (emailLogsTrigger) params.set('trigger', emailLogsTrigger)
      if (emailLogsType) params.set('type', emailLogsType)
      if (emailLogsDateFrom) params.set('dateFrom', emailLogsDateFrom)
      if (emailLogsDateTo) params.set('dateTo', emailLogsDateTo)

      const response = await fetch(`/api/admin/email-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch email logs')
      }

      const data = await response.json()
      setEmailLogsList(data.logs || [])
      setEmailLogsTotal(data.total ?? 0)
      setEmailLogsPage(targetPage)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load sent emails')
    } finally {
      setIsLoadingEmailLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'sentEmails') {
      fetchEmailLogs(1)
    }
  }, [activeTab])

  // Debounced so every keystroke doesn't fire a request — 400ms is short enough to feel
  // live without hammering the API while the admin is still typing an address.
  useEffect(() => {
    if (activeTab !== 'sentEmails') return
    const t = setTimeout(() => fetchEmailLogs(1), 400)
    return () => clearTimeout(t)
  }, [emailLogsSearch])

  // Trigger and type filters need no debounce — they're selects, not free text.
  useEffect(() => {
    if (activeTab === 'sentEmails') fetchEmailLogs(1)
  }, [emailLogsTrigger, emailLogsType])

  // Date range needs no debounce either — discrete date-picker input, not free text.
  useEffect(() => {
    if (activeTab === 'sentEmails') fetchEmailLogs(1)
  }, [emailLogsDateFrom, emailLogsDateTo])

  // Changing page size makes the current page number potentially meaningless, so jump
  // back to page 1 rather than trying to preserve scroll position across a resize.
  useEffect(() => {
    if (activeTab === 'sentEmails') fetchEmailLogs(1)
  }, [emailLogsPerPage])

  const yearOptions = [
    { value: 1, label: '1 Year' },
    { value: 2, label: '2 Years' },
    { value: 3, label: '3 Years' }
  ]

  const router = useRouter()
  const { admin, setAdmin } = useAdmin()

  useEffect(() => {
    if (admin) return
    try {
      const stored = localStorage.getItem('adminAuth')
      if (stored) {
        const parsed = JSON.parse(stored)
        const encoded = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD || 'TXBjbjYyJQ=='
        if (parsed.expires > new Date().getTime() && parsed.passwordHash && atob(parsed.passwordHash) === atob(encoded)) {
          setAdmin(true)
          return
        }
        localStorage.removeItem('adminAuth')
      }
    } catch {
      // ignore
    }
    router.push('/admin')
  }, [router, admin, setAdmin])

  useEffect(() => {
    setPaymentLink('')
    setCopiedLink(false)
  }, [users, totalPrice, selectedEdition, selectedYears, discountAmount])

  useEffect(() => {
    setCurrentPage(1)
  }, [advDateFrom, advDateTo, logsPerPage])

  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/consent-logs?includeEvents=true', {
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch consent logs')
      }

      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load logs')
    } finally {
      setIsLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
  }, [activeTab])

  const calculateTotal = () => {
    const price = parseFloat(totalPrice) || 0
    const discount = parseFloat(discountAmount) || 0
    return Math.max(price - discount, 0)
  }

  const generatePaymentLink = () => {
    const price = parseFloat(totalPrice) || 0
    const discount = parseFloat(discountAmount) || 0

    if (discount > price) {
      toast.error('Discount cannot be greater than total price!')
      return
    }

    const gatewayFlag =
      selectedGateway === 'authorize' ? 'GA' :
      selectedGateway === 'online' ? 'GO' :
      selectedGateway === 'antom' ? 'GAN' :
      selectedGateway === 'mor' ? 'GM' :
      selectedGateway === 'shopify' ? 'GSH' :
      selectedGateway === 'paydollar' ? 'GPD' : 'GT'

    let paymentString = ''

    if (['a','b','c','d','e','f','g','h','i','j','k','l','m','n'].includes(selectedEdition)) {
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)
      paymentString = `S${selectedEdition}K${dStr}M${tStr}${gatewayFlag}`
    } else {
      const editionMap: Record<string, string> = { silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', fsp: 'F' }
      const shortEdition = editionMap[selectedEdition] || 'S'

      const uStr = users.toString(36)
      const yStr = selectedYears.toString(36)
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)

      paymentString = `${uStr}${shortEdition}${yStr}K${dStr}M${tStr}${gatewayFlag}`
    }

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const base = isLocalhost ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin)
    if (paymentString) {
      setPaymentLink(`${base}/invoice/${paymentString}`)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink)
    setCopiedLink(true)
    toast.success('Payment link copied!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSimulatePayment = async () => {
    setIsSimulating(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/simulate-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Simulation failed')
      }

      toast.success('Simulated successful payment!')
      fetchLogs()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Simulation failed')
    } finally {
      setIsSimulating(false)
    }
  }

  const deleteTestLogs = async () => {
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/delete-test-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Deletion failed')
      }

      toast.success('Test logs deleted successfully!')
      fetchLogs()
      setSelectedLog(null)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Deletion failed')
    }
  }

  const markLogAsPaid = async (id: string) => {
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/mark-paid', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      })

      if (!response.ok) {
        throw new Error('Update failed')
      }

      toast.success('Transaction marked as paid!')
      fetchLogs()
      if (selectedLog && selectedLog._id === id) {
        setSelectedLog({ ...selectedLog, status: 'Completed', paidAt: new Date().toISOString() })
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Update failed')
    }
  }

  const downloadPDF = async (log: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const primaryColor = [44, 160, 28]
      const darkColor = [33, 37, 41]
      const grayColor = [108, 117, 125]

      const firstInitial = log.firstName ? log.firstName.charAt(0).toUpperCase() : ''
      const lastInitial = log.lastName ? log.lastName.charAt(0).toUpperCase() : ''
      const initials = `${firstInitial}${lastInitial}`
      const watermarkText = `Initial: ${initials}`

      const dateSuffix = (() => {
        const d = new Date(log.paidAt || log.createdAt || log.agreedTimestamp)
        return isNaN(d.getTime()) ? '' : `_${d.toISOString().slice(0, 10)}`
      })()

      const drawWatermark = () => {
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(75, 75, 75)
        doc.text(watermarkText, 198, 288, { align: 'right' })
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      }

      const termsText = `TERMS AND CONDITIONS
Last Updated: May 27, 2026

1. Introduction
Welcome to QuickBooks Solutions ("Company," "we," "us," or "our"). We provide software licenses, subscriptions, and specialized setup services ("Services"). By completing payment or accessing our Services, you ("Customer," "you," or "your") agree to be bound by these Terms and Conditions ("Terms").

2. Services & Licensing
We deliver and support software products including QuickBooks Enterprise licenses, cloud hosting access, and support subscriptions. Specific deliverables and pricing are outlined in the associated order.

3. Payment Terms & No Refunds
ALL SALES ARE FINAL. We accept payment via Authorize.net, Online Payment (Wire/ACH/Credit Card), and Stripe. No refunds, credits, or exchanges will be issued for change of mind or business changes.

4. No Chargebacks & Legal Consequences
By accepting these Terms, you expressly agree NOT to initiate an unauthorized chargeback with your financial institution. Any improper dispute shall constitute a material breach, and you agree to reimburse all associated legal, administrative, and collection expenses incurred to recover the disputed amount.

5. Delivery and Acceptance
Software deliverables and service fulfillment are deemed accepted upon electronic dispatch and credential provisioning.

6. Limitation of Liability
Our total liability for any claim arising from these Terms or the Services shall not exceed the amount paid by you in the preceding 12 months.

7. Governing Law
These Terms are governed by Delaware law and subject to binding dispute arbitration.`;

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text('QUICKBOOKS SOLUTIONS', 20, 25)

      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])

      const lines = doc.splitTextToSize(termsText, 160)
      let cursorY = 40
      const marginY = 280

      drawWatermark()

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (
          line === 'TERMS AND CONDITIONS' || 
          /^[0-9]+\.\s[A-Z]/.test(line) ||
          /^[0-9]+\.[0-9]+\s[A-Z]/.test(line)
        ) {
          doc.setFont('Helvetica', 'bold')
          if (line === 'TERMS AND CONDITIONS') doc.setFontSize(14)
          else doc.setFontSize(10)
        } else {
          doc.setFont('Helvetica', 'normal')
          doc.setFontSize(10)
        }

        doc.text(line, 20, cursorY)
        cursorY += 6

        if (cursorY >= marginY && i < lines.length - 1) {
          doc.addPage()
          drawWatermark()
          cursorY = 20
        }
      }

      doc.addPage()

      const drawDivider = (y: number) => {
        doc.setDrawColor(220, 224, 230)
        doc.setLineWidth(0.5)
        doc.line(20, y, 190, y)
      }

      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text('CERTIFICATE OF CONSENT & PURCHASE AGREEMENT', 100, 35, { align: 'center' })
      
      drawDivider(42)

      doc.setFontSize(10)
      doc.setFont('Helvetica', 'bold')
      doc.text('ELECTRONIC SIGNATURE METADATA', 20, 50)

      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      
      const metaY = 57
      doc.text(`Consent Record ID:   ${log._id}`, 20, metaY)

      const timeString = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(log.agreedTimestamp || Date.now())) + ' EST'

      doc.text(`Timestamp:          ${timeString}`, 20, metaY + 6)
      doc.text(`IP Address:         ${log.ipAddress || 'N/A'}`, 20, metaY + 12)
      doc.text(`Device Type:        ${log.deviceType || 'Desktop'}`, 20, metaY + 18)
      doc.text(`Browser / Client:   ${log.browser || 'Unknown'}`, 20, metaY + 24)
      doc.text(`Consent Agreement:  AGREED (Terms & Privacy explicitly checked by client)`, 20, metaY + 30)
      
      drawDivider(metaY + 36)

      doc.setFont('Helvetica', 'bold')
      doc.text('CUSTOMER BILLING DETAILS', 20, metaY + 46)

      doc.setFont('Helvetica', 'normal')
      const profileY = metaY + 53
      doc.text(`Full Name:          ${log.firstName || ''} ${log.lastName || ''}`, 20, profileY)
      doc.text(`Email Address:      ${log.email || 'N/A'}`, 20, profileY + 6)
      doc.text(`Company Name:       ${log.companyName || 'N/A'}`, 20, profileY + 12)
      let formattedEin = log.ein || 'N/A'
      if (formattedEin !== 'N/A' && formattedEin.replace(/\D/g, '').length === 9) {
        const d = formattedEin.replace(/\D/g, '')
        formattedEin = `${d.slice(0, 2)}-${d.slice(2)}`
      }
      doc.text(`EIN:                ${formattedEin}`, 20, profileY + 18)
      doc.text(`Phone Number:       ${log.phone || 'N/A'}`, 20, profileY + 24)
      doc.text(`Street Address:     ${log.address || 'N/A'}`, 20, profileY + 30)
      doc.text(`City & State:       ${log.city || ''}, ${log.state || ''}`, 20, profileY + 36)
      doc.text(`ZIP Code & Country: ${log.zipCode || ''}, ${log.country || 'US'}`, 20, profileY + 42)

      drawDivider(profileY + 48)

      doc.setFont('Helvetica', 'bold')
      doc.text('ORDER & SUBSCRIPTION SUMMARY', 20, profileY + 58)

      doc.setFont('Helvetica', 'normal')
      const orderY = profileY + 65
      doc.text(`Product Name:       ${log.planDetails || 'QuickBooks Enterprise'}`, 20, orderY)
      doc.text(`Total Price:        $${Number(log.amountUSD || log.amount || 0).toFixed(2)} USD`, 20, orderY + 6)
      doc.text(`Status:             ${log.status === 'Completed' ? 'Completed & Paid' : 'Pending Payment'}`, 20, orderY + 12)
      let orderLineOffset = 12
      if (log.paymentGateway) {
        orderLineOffset += 6
        doc.text(`Payment Gateway:    ${log.paymentGateway}`, 20, orderY + orderLineOffset)
      }

      if (log.clientSignatureBase64) {
        const sigY = orderY + orderLineOffset + 17
        
        doc.setFont('Times', 'normal')
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text('Customer Signature:', 20, sigY + 13)
        
        doc.setDrawColor(68, 0, 230)
        doc.setLineWidth(0.6)
        doc.line(65, sigY + 2, 66, sigY + 1)
        doc.line(66, sigY + 1, 68, sigY + 1)
        doc.line(65, sigY + 2, 65, sigY + 21)
        doc.line(65, sigY + 21, 66, sigY + 22)
        doc.line(66, sigY + 22, 68, sigY + 22)
        
        doc.setFontSize(8)
        doc.setFont('Helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text('Signed by:', 69, sigY + 2.5)
        
        try {
          const props = doc.getImageProperties(log.clientSignatureBase64)
          const imgRatio = props.width / props.height
          let imgHeight = 14
          let imgWidth = 14 * imgRatio
          
          if (imgWidth > 80) {
            imgWidth = 80
            imgHeight = 80 / imgRatio
          }
          
          const yOffset = (15 - imgHeight) / 2
          doc.addImage(log.clientSignatureBase64, 'PNG', 69, sigY + 3 + yOffset, imgWidth, imgHeight)
        } catch {
          doc.addImage(log.clientSignatureBase64, 'PNG', 69, sigY + 4, 50, 15)
        }
        
        doc.setFontSize(7)
        doc.setFont('Helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const transId = log._id ? log._id.toString() : 'N/A'
        const shortId = transId.length > 15 ? transId.substring(0, 15) + '...' : transId
        doc.text(`Transaction ID: ${shortId}`, 69, sigY + 23.5)
        
        doc.setFont('Times', 'normal')
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        const dateStr = formatDateMMDDYYYY(log.agreedTimestamp || Date.now(), 'America/New_York') + ' EST'
        doc.text(`Date:  ${dateStr}`, 150, sigY + 13)
      }

      // Payment Proof attachment
      if (log.paymentGateway === 'Online Payment' && log.paymentProofType !== 'pdf' && log.paymentProofUrl) {
        doc.addPage()
        drawWatermark()

        doc.setFillColor(124, 58, 237)
        doc.rect(0, 0, 210, 16, 'F')
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text('PAYMENT PROOF ATTACHMENT', 20, 10.5)

        try {
          const imgResponse = await fetch(`/api/proxy-fetch?url=${encodeURIComponent(log.paymentProofUrl)}`)
          const imgBlob = await imgResponse.blob()
          const imgBase64: string = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = rej
            reader.readAsDataURL(imgBlob)
          })

          const img = new Image()
          await new Promise<void>((res, rej) => {
            img.onload = () => res()
            img.onerror = rej
            img.src = imgBase64
          })

          const maxW = 170
          const maxH = 190
          const ratio = img.naturalWidth / img.naturalHeight
          let pw = maxW
          let ph = maxW / ratio
          if (ph > maxH) { ph = maxH; pw = maxH * ratio }
          const xCenter = (210 - pw) / 2

          doc.addImage(imgBase64, 'JPEG', xCenter, 40, pw, ph)
        } catch {
          doc.setFontSize(9)
          doc.setTextColor(180, 0, 0)
          doc.text('Could not embed image proof.', 20, 40)
        }
      }

      doc.setFontSize(8)
      doc.setFont('Helvetica', 'oblique')
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      const footerText = 'This certificate serves as legally binding digital evidence that the customer explicitly agreed to the Terms of Service when initiating their order.'
      const splitFooter = doc.splitTextToSize(footerText, 170)
      doc.text(splitFooter, 20, 265)

      // Merge proof PDF if PDF
      if (log.paymentGateway === 'Online Payment' && log.paymentProofType === 'pdf' && log.paymentProofUrl) {
        try {
          toast.loading('Merging payment proof PDF...', { id: 'pdf-merge' })
          const consentPdfBytes = doc.output('arraybuffer')
          const mergedDoc = await PDFDocument.load(consentPdfBytes, { ignoreEncryption: true })

          let pdfFetchUrl = log.paymentProofUrl
          if (!pdfFetchUrl.toLowerCase().endsWith('.pdf') && !pdfFetchUrl.toLowerCase().endsWith('.txt')) {
            pdfFetchUrl = pdfFetchUrl + '.txt'
          }
          
          const proofResponse = await fetch(`/api/proxy-fetch?url=${encodeURIComponent(pdfFetchUrl)}`)
          if (!proofResponse.ok) throw new Error('Could not fetch proof PDF.')
          const proofPdfBytes = await proofResponse.arrayBuffer()

          const proofDoc = await PDFDocument.load(proofPdfBytes, { ignoreEncryption: true })
          const proofPageCount = proofDoc.getPageCount()
          const copiedPages = await mergedDoc.copyPages(proofDoc, Array.from({ length: proofPageCount }, (_, i) => i))

          if (copiedPages.length > 0) {
            const firstPage = copiedPages[0]
            const helveticaBold = await mergedDoc.embedFont(StandardFonts.HelveticaBold)
            firstPage.drawText('Payment Proof', {
              x: 20,
              y: firstPage.getHeight() - 25,
              size: 11,
              font: helveticaBold,
              color: rgb(0.48, 0.22, 0.92),
            })
          }

          copiedPages.forEach(page => mergedDoc.addPage(page))

          const mergedPdfBytes = await mergedDoc.save()
          const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Consent_Certificate_${log.lastName || 'Customer'}_${log.firstName || 'Client'}${dateSuffix}.pdf`
          a.click()
          URL.revokeObjectURL(url)

          toast.dismiss('pdf-merge')
          toast.success('PDF Certificate downloaded!')
        } catch {
          toast.dismiss('pdf-merge')
          doc.save(`Consent_Certificate_${log.lastName || 'Customer'}_${log.firstName || 'Client'}${dateSuffix}.pdf`)
          toast.success('PDF downloaded (consent certificate only).')
        }
      } else {
        doc.save(`Consent_Certificate_${log.lastName || 'Customer'}_${log.firstName || 'Client'}${dateSuffix}.pdf`)
        toast.success('PDF Certificate downloaded!')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    }
  }

  const TEST_EMAILS = ['info@qualitybusinesstech.us', 'nick.powerjobs@gmail.com', 'contact@qbenterprise.us'].map(e => e.toLowerCase())
  const estDateKeyFormatter = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }), [])

  const displayedLogs = logs.filter(log => {
    const isTestRecord = (
      (log.email && TEST_EMAILS.includes(log.email.toLowerCase())) ||
      (log.fsOrderReference && log.fsOrderReference.includes('MOCK')) ||
      (log.fsOrderId && log.fsOrderId.includes('MOCK'))
    )

    if (filterMode === 'Test') {
      if (!isTestRecord) return false
    } else {
      if (isTestRecord) return false
    }

    if (advGateway !== 'All') {
      if (advGateway === 'Authorize.net' && log.paymentGateway !== 'Authorize.net') return false
      if (advGateway === 'Online Payment' && log.paymentGateway !== 'Online Payment') return false
      if (advGateway === 'Stripe' && log.paymentGateway !== 'Stripe') return false
      if (advGateway === 'Shopify' && log.paymentGateway !== 'Shopify') return false
    }

    if (advStatus !== 'All' && log.status !== advStatus) return false

    if (advAmount !== 'All') {
      const amt = Number(log.amountUSD || log.amount || 0)
      if (advAmount === '<50' && amt >= 50) return false
      if (advAmount === '50-500' && (amt < 50 || amt > 500)) return false
      if (advAmount === '>500' && amt <= 500) return false
    }

    if (advDateFrom || advDateTo) {
      if (!log.agreedTimestamp) return false
      const logDateKey = estDateKeyFormatter.format(new Date(log.agreedTimestamp))
      if (advDateFrom && logDateKey < advDateFrom) return false
      if (advDateTo && logDateKey > advDateTo) return false
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const searchableString = `
        ${log.firstName || ''} ${log.lastName || ''} 
        ${log.email || ''} 
        ${log.planDetails || ''} 
        ${log.ipAddress || ''}
        ${log.agreedTimestamp ? formatDateMMDDYYYY(log.agreedTimestamp, 'America/New_York') : ''}
      `.toLowerCase()
      
      const queryParts = query.split(/\s+/).filter(Boolean)
      if (!queryParts.every(part => searchableString.includes(part))) return false
    }

    return true
  })

  const totalPages = Math.ceil(displayedLogs.length / logsPerPage) || 1
  const indexOfLastLog = currentPage * logsPerPage
  const indexOfFirstLog = indexOfLastLog - logsPerPage
  const currentLogs = displayedLogs.slice(indexOfFirstLog, indexOfLastLog)

  return (
    <div className="min-h-screen bg-zinc-50/50 py-6 md:py-10 text-zinc-950 font-sans antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Title Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between pb-6 mb-8 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Admin Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1 font-normal">Generate invoice payment links and view electronic signature audits.</p>
          </div>

          <div className="w-full lg:w-auto">
            <div className="flex flex-wrap md:inline-flex md:flex-nowrap items-center gap-1 rounded-lg bg-zinc-100 p-1 text-zinc-500 border border-zinc-200/50 font-medium">
              {[
                { key: 'create', label: 'Links', title: 'Payment Links', icon: <LinkIcon size={14} /> },
                { key: 'logs', label: 'Consent', title: 'Consent Logs', icon: <ShieldCheck size={14} className="text-[#2ca01c]" /> },
                { key: 'email', label: 'Send', title: 'Send Email', icon: <Mail size={14} className="text-[#2ca01c]" /> },
                { key: 'sentEmails', label: 'Logs', title: 'Email Logs', icon: <MailWarning size={14} className="text-[#2ca01c]" /> },
                { key: 'surveys', label: 'Surveys', title: 'Surveys', icon: <MessageSquare size={14} className="text-[#2ca01c]" />, href: '/admin/surveys' },
              ].map((tab) => {
                const base = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 sm:px-4 py-2 md:py-1.5 text-xs md:text-sm font-semibold transition-all cursor-pointer select-none'
                const active = 'bg-white text-zinc-950 shadow-sm'
                const idle = 'hover:text-zinc-900 text-zinc-500'
                if (tab.href) {
                  return (
                    <NextLink key={tab.key} href={tab.href} title={tab.title} className={`${base} ${idle}`}>
                      {tab.icon}
                      {tab.label}
                    </NextLink>
                  )
                }
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'create' | 'logs' | 'email' | 'sentEmails')}
                    title={tab.title}
                    className={`${base} ${activeTab === tab.key ? active : idle}`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tab 1: Configure & Create Payment Link */}
        {activeTab === 'create' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Form Configuration Card */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl shadow-xs p-6 md:p-8 space-y-6">
              
              {/* Payment Gateway Toggle */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <label className="block mb-2 font-medium text-xs text-zinc-500 uppercase tracking-wider">Payment Gateway</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white rounded-md border border-zinc-200 p-1">
                  {/* Only Shopify is live. The other gateways are kept here, commented out,
                      rather than deleted: their checkout branches in /order-summary and their
                      API routes are untouched, so any link already issued under them still
                      works. Uncomment a button to put that gateway back in the picker. */}
                  {/*
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('authorize')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'authorize' ? 'bg-[#0075ff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Authorize.net
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('online')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'online' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Online Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('stripe')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'stripe' ? 'bg-[#635bff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Stripe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('mor')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'mor' ? 'bg-[#111827] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    MOR.AI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('antom')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'antom' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Antom
                  </button>
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('shopify')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'shopify' ? 'bg-[#95BF47] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Shopify
                  </button>
                  {/*
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('paydollar')
                      setPaymentLink('')
                    }}
                    className={`text-xs font-semibold py-2 px-2 rounded transition-colors text-center ${selectedGateway === 'paydollar' ? 'bg-[#e4002b] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    PayDollar
                  </button>
                  */}
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Layers size={16} className="text-zinc-400" />
                  Configure Invoice Tiers
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Define user counts, editions, and pricing rules.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">QuickBooks Edition</label>
                  <select
                    value={selectedEdition}
                    onChange={(e) => {
                      setSelectedEdition(e.target.value)
                      setPaymentLink('')
                    }}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    <optgroup label="QuickBooks Enterprise">
                      {editions.map((e) => (
                        <option key={e.value} value={e.value}>
                          QuickBooks Enterprise 24.0 {e.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Products">
                      {customProducts.map((e) => (
                        <option key={e.value} value={e.value}>
                          {e.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {['silver', 'gold', 'platinum', 'diamond', 'fsp'].includes(selectedEdition) && (
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Number of Users</label>
                    <input
                      type="number"
                      min="1"
                      value={users}
                      onChange={(e) => {
                         setUsers(Math.max(1, parseInt(e.target.value) || 1))
                         setPaymentLink('')
                       }}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                    />
                  </div>
                )}
              </div>

              {['silver', 'gold', 'platinum', 'diamond', 'fsp'].includes(selectedEdition) && (
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Contract Period</label>
                  <select
                    value={selectedYears}
                    onChange={(e) => {
                      setSelectedYears(parseInt(e.target.value))
                      setPaymentLink('')
                    }}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    {yearOptions.map((y) => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Price ($)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 3500"
                  value={totalPrice}
                  onChange={(e) => {
                    setTotalPrice(e.target.value)
                    setPaymentLink('')
                  }}
                  className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 font-semibold"
                />
              </div>

              <div className="border-t border-zinc-100 pt-5">
                <label className="block mb-1.5 font-medium text-xs text-zinc-400">Discount ($) <span className="text-[10px] text-zinc-400 italic font-normal">(Optional secondary override)</span></label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={discountAmount}
                  onChange={(e) => {
                    const value = e.target.value
                    const discount = parseFloat(value) || 0
                    const price = parseFloat(totalPrice) || 0

                    if (discount > price) {
                      toast.error('Discount cannot be greater than total price!')
                      return
                    }

                    setDiscountAmount(value)
                    setPaymentLink('')
                  }}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-500 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300"
                />
              </div>
            </div>

            {/* Right Column: Dynamic Preview + Action Card */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Order Invoice Card */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Summary Preview</h3>
                
                <div className="space-y-3 text-xs border-t pt-3 border-zinc-100 font-medium">
                  <div className="flex justify-between text-zinc-500">
                    <span>Gateway:</span>
                    <span className="text-zinc-900 font-semibold uppercase">{selectedGateway}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Edition:</span>
                    <span className="text-zinc-900 font-semibold">
                      {['a','b','c','d','e','f','g','h','i','j','k','l','m','n'].includes(selectedEdition) 
                        ? customProducts.find(c => c.value === selectedEdition)?.name 
                        : `24.0 ${selectedEdition.charAt(0).toUpperCase() + selectedEdition.slice(1)}`
                      }
                    </span>
                  </div>
                  {['silver', 'gold', 'platinum', 'diamond', 'fsp'].includes(selectedEdition) && (
                    <>
                      <div className="flex justify-between text-zinc-500">
                        <span>User Count:</span>
                        <span className="text-zinc-900 font-semibold">{users} {users === 1 ? 'User' : 'Users'}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Subscription Term:</span>
                        <span className="text-zinc-900 font-semibold">{selectedYears} {selectedYears === 1 ? 'Year' : 'Years'}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-zinc-500">
                    <span>Base Amount:</span>
                    <span className="text-zinc-900 font-semibold">${parseFloat(totalPrice || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {parseFloat(discountAmount) > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Discount Override:</span>
                      <span className="text-red-500 font-semibold">-${parseFloat(discountAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-sm text-zinc-900 mt-4 pt-4 border-t border-zinc-100">
                    <span>Total Price:</span>
                    <span className="text-[#2ca01c] text-lg font-extrabold">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Action Button Card */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Generate Link</h3>
                
                {paymentLink ? (
                  <div className="space-y-4">
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-xs font-mono font-medium text-zinc-700 break-all select-all">
                      {paymentLink}
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm shadow-zinc-950/10"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={generatePaymentLink}
                    disabled={!totalPrice || parseFloat(discountAmount) > parseFloat(totalPrice)}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 text-white disabled:text-zinc-400 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed border border-zinc-950/10"
                  >
                    Generate Payment Link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Compliance T&C Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-4 md:p-6 space-y-6">
            
            {/* Header controls bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg text-zinc-900">Signed Consent Certificates</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Compliance records of B2B terms signatures logged in MongoDB.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto font-medium">
                <button
                  type="button"
                  onClick={() => setFilterMode('All')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-xs ${filterMode === 'All' ? 'bg-[#2ca01c] text-white border-[#2ca01c]' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
                >
                  <Filter size={12} />
                  All Transactions
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('Test')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-xs ${filterMode === 'Test' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
                >
                  <Filter size={12} />
                  Test Transactions
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    type="button"
                    onClick={handleSimulatePayment}
                    disabled={isSimulating}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 shadow-xs border border-zinc-950/10"
                  >
                    <RefreshCw size={12} className={isSimulating ? 'animate-spin' : ''} />
                    {isSimulating ? 'Simulating...' : 'Simulate Payment'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={isLoadingLogs}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
            
            {/* Advanced Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-zinc-50/80 border border-zinc-100 rounded-lg text-xs">
              <span className="font-semibold text-zinc-500 mr-2 uppercase tracking-wider text-[10px]">Filters:</span>
              
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search name, email, plan, date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-full border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium placeholder:text-zinc-400"
                />
              </div>

              <select 
                value={advGateway}
                onChange={(e) => setAdvGateway(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Gateways</option>
                <option value="Authorize.net">Authorize.net Only</option>
                <option value="Online Payment">Online Payment Only</option>
                <option value="Stripe">Stripe Only</option>
                <option value="Shopify">Shopify Only</option>
              </select>
              
              <select 
                value={advStatus}
                onChange={(e) => setAdvStatus(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Completed">Completed Only</option>
                <option value="Pending">Pending Only</option>
                <option value="Failed">Failed Only</option>
              </select>
              
              <select
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Amounts</option>
                <option value="<50">Under $50</option>
                <option value="50-500">$50 to $500</option>
                <option value=">500">Over $500</option>
              </select>

              <div className="flex items-center gap-1">
                <DateFilterInput
                  value={advDateFrom}
                  onChange={setAdvDateFrom}
                  maxIso={advDateTo || getTodayDateString('America/New_York')}
                  className="px-2 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium w-[100px]"
                />
                <span className="text-zinc-400 text-[10px]">to</span>
                <DateFilterInput
                  value={advDateTo}
                  onChange={setAdvDateTo}
                  maxIso={getTodayDateString('America/New_York')}
                  className="px-2 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium w-[100px]"
                />
              </div>

              <select
                value={logsPerPage}
                onChange={(e) => setLogsPerPage(Number(e.target.value))}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            {isLoadingLogs ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-xs text-zinc-500 font-medium tracking-wide">Retrieving logs from database...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                <AlertCircle className="mx-auto text-zinc-400 mb-3" size={32} />
                <h4 className="font-semibold text-zinc-800 text-sm">No Logs Registered</h4>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1.5 px-4">Once B2B invoices are paid and customer signatures are verified, compliance logs will appear here.</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider bg-zinc-50/50">
                        <th className="py-3.5 px-4 font-bold">Date & Time</th>
                        <th className="py-3.5 px-4 font-bold">Client Profile</th>
                        <th className="py-3.5 px-4 font-bold">Product & Amount</th>
                        <th className="py-3.5 px-4 font-bold">Status</th>
                        <th className="py-3.5 px-4 text-center font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {currentLogs.map((log) => {
                        if (log.logType === 'user_session') {
                          return (
                            <tr key={log._id} className="hover:bg-blue-50/50 transition-colors bg-blue-50/20">
                              <td className="py-4 px-4 align-top whitespace-nowrap">
                                <span className="font-bold text-zinc-900 block">
                                  {formatDateMMDDYYYY(log.agreedTimestamp, 'America/New_York')}
                                </span>
                                <span className="text-zinc-500 block text-[10px] mt-0.5">
                                  {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })} EST
                                </span>
                              </td>
                              <td className="py-4 px-4 align-top">
                                <div className="font-semibold text-blue-700 text-sm flex items-center gap-1.5">
                                  <Eye size={14} /> Activity Session
                                </div>
                                {log.email && <div className="text-zinc-900 font-medium mt-2">{log.email}</div>}
                                <div className="text-[10px] text-zinc-400 mt-1 font-medium">IP: {log.ipAddress}</div>
                                {log.paymentId && <div className="text-[10px] text-zinc-400 mt-0.5 font-medium mb-1">ID: {log.paymentId}</div>}
                                
                                {log.paymentGateway === 'Authorize.net' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                                    AUTH.NET
                                  </span>
                                )}
                                {log.paymentGateway === 'Stripe' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1">
                                    STRIPE
                                  </span>
                                )}
                                {log.paymentGateway === 'Online Payment' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-50 text-violet-700 border border-violet-200 mt-1">
                                    MANUAL
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 align-top">
                                {log.amount ? (
                                  <div className="font-extrabold text-zinc-600 text-sm">${Number(log.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                ) : (
                                  <div className="font-extrabold text-zinc-400 text-sm">--</div>
                                )}
                                {log.planDetails && <div className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-xs font-medium bg-white p-1.5 rounded-lg border border-zinc-100">{log.planDetails}</div>}
                              </td>
                              <td className="py-4 px-4 align-top">
                                <div className="flex flex-col gap-1.5 bg-zinc-50/50 p-2 rounded-lg border border-zinc-100">
                                  <span className="text-[11px] font-bold text-zinc-700">
                                    {log.events?.length || 0} Interaction{(log.events?.length !== 1) && 's'}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">
                                    Latest:{' '}
                                    <span className="font-bold text-blue-700 uppercase tracking-wider">
                                      {log.events && log.events.length > 0
                                        ? formatEventLabel(log.events[log.events.length - 1].event)
                                        : 'N/A'}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 align-top text-center whitespace-nowrap space-y-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLog(log)}
                                  className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-blue-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs bg-white hover:bg-blue-50 text-blue-700 cursor-pointer"
                                >
                                  <Eye size={12} className="text-blue-500" />
                                  Session Timeline
                                </button>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={log._id} className="hover:bg-zinc-50/40 transition-colors">
                            <td className="py-4 px-4 align-top whitespace-nowrap">
                              <span className="font-bold text-zinc-900 block">
                                {formatDateMMDDYYYY(log.agreedTimestamp, 'America/New_York')}
                              </span>
                              <span className="text-zinc-500 block text-[10px] mt-0.5">
                                {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })} EST
                              </span>
                            </td>
                            
                            <td className="py-4 px-4 align-top">
                              <div className="font-semibold text-zinc-950 text-sm">{log.firstName} {log.lastName}</div>
                              <div className="text-zinc-500 font-medium mt-0.5">{log.email}</div>
                              {log.companyName && <div className="text-[10px] font-semibold text-purple-700 mt-1 bg-purple-50 px-2 py-0.5 rounded-md inline-block">{log.companyName}</div>}
                              {log.phone && <div className="text-[10px] text-zinc-400 mt-1 font-medium">📞 {log.phone}</div>}
                              
                              {log.address && (
                                <div className="text-[10px] text-zinc-500 mt-2 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/60 leading-relaxed max-w-xs">
                                  <span className="font-semibold text-zinc-700 block text-[9px] uppercase tracking-wider mb-0.5">Billing Address:</span>
                                  {log.address}, {log.city}, {log.state} {log.zipCode}, {log.country || 'US'}
                                </div>
                              )}
                            </td>
                            
                            <td className="py-4 px-4 align-top">
                              <div className="font-extrabold text-[#2ca01c] text-sm">${Number(log.amountUSD || log.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-xs font-medium bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">{log.planDetails}</div>
                              {log.paymentGateway && (
                                <div className="text-[10px] font-semibold text-zinc-600 mt-1.5 inline-flex items-center gap-1">
                                  💳 {log.paymentGateway}
                                </div>
                              )}
                            </td>

                            <td className="py-4 px-4 align-top whitespace-nowrap">
                              {log.status === 'Completed' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                  <span className="w-1 h-1 rounded-full bg-green-600"></span>
                                  Completed
                                </span>
                              ) : log.status === 'Failed' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                  <span className="w-1 h-1 rounded-full bg-red-600"></span>
                                  Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                  Pending
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 align-top text-center whitespace-nowrap space-y-2">
                              <button
                                type="button"
                                onClick={() => setSelectedLog(log)}
                                className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                              >
                                <Eye size={12} className="text-zinc-500" />
                                View Details
                              </button>
                              <br />
                              <button
                                type="button"
                                onClick={() => downloadPDF(log)}
                                disabled={log.status !== 'Completed'}
                                title={log.status !== 'Completed' ? "Payment pending. PDF unavailable." : ""}
                                className={`w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs ${log.status === 'Completed' ? 'bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer' : 'bg-zinc-50 text-zinc-400 cursor-not-allowed opacity-60'}`}
                              >
                                <FileText size={12} className={log.status === 'Completed' ? 'text-zinc-500' : 'text-zinc-400'} />
                                PDF Consent
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="block lg:hidden space-y-4">
                  {currentLogs.map((log) => (
                    <MobileLogCard key={log._id} log={log} downloadPDF={downloadPDF} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-5 mt-6">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <span className="text-xs text-zinc-500 font-semibold bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200/50">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Modal Detail Viewer */}
            {selectedLog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-200 relative animate-in zoom-in-95 duration-200">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="absolute top-5 right-5 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors z-10 border border-zinc-200"
                  >
                    <X size={20} />
                  </button>

                  <div className="overflow-y-auto flex-1 p-6 md:p-8">
                    {selectedLog.logType === 'user_session' ? (
                      <>
                        <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                          <h2 className="text-xl font-bold text-zinc-900">Activity Session Timeline</h2>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Tracked Session
                          </span>
                        </div>

                        <div className="space-y-6 text-sm">
                          <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">User Identifier</p>
                              <p className="font-semibold text-zinc-900">{selectedLog.email || 'Unknown'}</p>
                              <p className="text-zinc-500 text-xs mt-0.5">IP: {selectedLog.ipAddress}</p>
                              {selectedLog.paymentId && <p className="text-zinc-500 text-xs mt-0.5 font-mono">ID: {selectedLog.paymentId}</p>}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Targeted Product</p>
                              <p className="font-semibold text-zinc-900">{selectedLog.planDetails || 'N/A'}</p>
                              <p className="text-[#2ca01c] font-bold mt-0.5">${selectedLog.amount ? Number(selectedLog.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</p>
                            </div>
                          </div>

                          <div>
                            <h3 className="font-bold text-zinc-900 mb-4 border-b border-zinc-100 pb-2">Event Timeline</h3>
                            <div className="space-y-4 border-l-2 border-blue-200 ml-3 pb-2 overflow-y-auto" style={{ maxHeight: '380px' }}>
                              {selectedLog.events && selectedLog.events.map((evt: any, i: number) => (
                                <div key={i} className="relative pl-6">
                                  <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-4 border-2 border-white shadow-sm"></div>
                                  <div className="bg-white border border-zinc-100 p-3 rounded-lg shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-bold text-blue-800 text-xs uppercase tracking-wide bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                          {formatEventLabel(evt.event)}
                                        </span>
                                        {evt.email && <p className="text-xs text-zinc-600 mt-2 font-medium">Email: {evt.email}</p>}
                                        {evt.detail && typeof evt.detail === 'object' && (
                                          <p className="text-xs text-zinc-500 mt-1 font-mono">
                                            {Object.entries(evt.detail).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="block text-xs font-semibold text-zinc-700">{new Date(evt.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST</span>
                                        <span className="block text-[10px] text-zinc-400">{formatDateMMDDYYYY(evt.timestamp, 'America/New_York')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                          <h2 className="text-xl font-bold text-zinc-900">Transaction Record</h2>
                          {selectedLog.status === 'Completed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Customer</p>
                              <p className="font-semibold text-zinc-900 text-base">{selectedLog.firstName} {selectedLog.lastName}</p>
                              <p className="text-zinc-500">{selectedLog.email}</p>
                              {selectedLog.phone && <p className="text-zinc-500 mt-1">📞 {selectedLog.phone}</p>}
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Company</p>
                              <p className="font-semibold text-zinc-800">{selectedLog.companyName || 'Not provided'}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Billing Address</p>
                              <p className="text-zinc-700">
                                {selectedLog.address ? `${selectedLog.address}, ${selectedLog.city}, ${selectedLog.state} ${selectedLog.zipCode}` : 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment Amount</p>
                              <p className="font-extrabold text-[#2ca01c] text-xl">${Number(selectedLog.amountUSD || selectedLog.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Product Details</p>
                              <p className="font-medium text-zinc-800">{selectedLog.planDetails}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Gateway</p>
                              <p className="font-medium text-zinc-800">{selectedLog.paymentGateway || 'Authorize.net'}</p>
                            </div>
                          </div>
                        </div>

                        {selectedLog.clientSignatureBase64 && (
                          <div className="mt-6 border-t border-zinc-100 pt-4">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Recorded Signature</p>
                            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 inline-block">
                              <img src={selectedLog.clientSignatureBase64} alt="Client Signature" className="max-h-24 max-w-xs object-contain" />
                            </div>
                          </div>
                        )}

                        <div className="mt-8 pt-4 border-t border-zinc-100 flex flex-wrap justify-between items-center gap-2">
                          <div className="flex gap-2">
                            {selectedLog.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={() => markLogAsPaid(selectedLog._id)}
                                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm cursor-pointer"
                              >
                                Mark as Paid
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadPDF(selectedLog)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm text-sm cursor-pointer"
                          >
                            <FileText size={16} />
                            Download Compliance PDF
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-8">
          <div className="max-w-2xl">
            <form onSubmit={sendCustomEmail} className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Mail size={16} className="text-zinc-400" />
                  Send Transactional Email
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Fill in the fields and send a receipt, payment reminder, or refund confirmation directly — no existing order required.</p>
              </div>

              {/* Email type toggle */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <label className="block mb-2 font-medium text-xs text-zinc-500 uppercase tracking-wider">Email Type</label>
                <div className="flex bg-white rounded-md border border-zinc-200 p-1">
                  <button
                    type="button"
                    onClick={() => setEmailType('success')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'success' ? 'bg-[#2ca01c] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Payment Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailType('failed')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'failed' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Payment Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailType('refund')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'refund' ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailType('survey')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'survey' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Survey
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailType('query')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'query' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Query
                  </button>
                </div>
              </div>

              {/* Common fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-zinc-900">
                    Recipient Email *
                    {isCheckingSingleHistory && <span className="ml-2 text-[10px] font-normal text-zinc-400">checking prior sends…</span>}
                  </label>
                  <input
                    type="email"
                    required
                    value={emailForm.toEmail}
                    onChange={(e) => updateEmailForm('toEmail', e.target.value)}
                    placeholder="customer@example.com"
                    className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 ${singleEmailDomainInvalid ? 'border-red-400 focus:ring-red-300/30' : 'border-[#2ca01c] focus:ring-[#2ca01c]/30'}`}
                  />
                  {singleEmailDomainInvalid && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      {singleEmailDomainInvalid} — this address will bounce.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Customer Name</label>
                  <input
                    type="text"
                    value={emailForm.customerName}
                    onChange={(e) => updateEmailForm('customerName', e.target.value)}
                    placeholder="Jane Doe"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">
                    Company Name
                    {emailType === 'survey' && <span className="text-[10px] text-zinc-400 italic font-normal"> (included in the survey link and shown in the email)</span>}
                  </label>
                  <input
                    type="text"
                    value={emailForm.companyName}
                    onChange={(e) => updateEmailForm('companyName', e.target.value)}
                    placeholder="Acme Corp"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                {emailType !== 'survey' && emailType !== 'query' && (
                  <>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Order ID <span className="text-[10px] text-zinc-400 italic font-normal">(optional, auto-generated if blank)</span></label>
                  <input
                    type="text"
                    value={emailForm.orderId}
                    onChange={(e) => updateEmailForm('orderId', e.target.value)}
                    placeholder="e.g. Mongo _id or invoice #"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">
                    Product
                    {reminderGateway === 'shopifySubscription' && (
                      <span className="text-[10px] text-zinc-400 italic font-normal"> (fixed to Payroll for Shopify Subscription)</span>
                    )}
                  </label>
                  <select
                    value={emailProductCode}
                    onChange={(e) => setEmailProductCode(e.target.value)}
                    disabled={reminderGateway === 'shopifySubscription'}
                    className={`flex h-10 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] ${reminderGateway === 'shopifySubscription' ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : 'bg-white text-zinc-800 cursor-pointer'}`}
                  >
                    <optgroup label="QuickBooks Enterprise">
                      {editions.map((e) => (
                        <option key={e.value} value={e.value}>{`QuickBooks Enterprise ${e.name} Edition`}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Products">
                      {customProducts.map((p) => (
                        <option key={p.value} value={p.value}>{p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {isEmailProductQbEdition && (
                  <>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Number of Users</label>
                      <input
                        type="number"
                        min="1"
                        value={emailUsers}
                        onChange={(e) => setEmailUsers(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Contract Period</label>
                      <select
                        value={emailYears}
                        onChange={(e) => setEmailYears(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                      >
                        <option value={1}>1 Year</option>
                        <option value={2}>2 Years</option>
                        <option value={3}>3 Years</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Plan / Product Details <span className="text-[10px] text-zinc-400 italic font-normal">(shown in the email — auto-filled from Product above)</span></label>
                  {!planDetailsIsCustom ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={emailForm.planDetails}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 shadow-xs cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setPlanDetailsIsCustom(true)}
                        className="shrink-0 px-3 rounded-md border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      >
                        Edit text
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={emailForm.planDetails}
                        onChange={(e) => updateEmailForm('planDetails', e.target.value)}
                        placeholder="Type a custom plan/product name"
                        className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setPlanDetailsIsCustom(false)}
                        className="shrink-0 px-3 rounded-md border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      >
                        Back to auto
                      </button>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">{emailType === 'refund' ? 'Refund Method Label' : 'Payment Method Label'}</label>
                  <input
                    type="text"
                    value={emailForm.paymentMethodLabel}
                    onChange={(e) => updateEmailForm('paymentMethodLabel', e.target.value)}
                    placeholder={emailType === 'success' ? 'e.g. VISA ending in 1234' : emailType === 'refund' ? 'e.g. VISA ending in 1234' : 'e.g. AMEX ending in 6043'}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                  </>
                )}
                {emailType === 'query' && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Title / Subject *</label>
                      <input
                        type="text"
                        required
                        value={emailForm.queryTitle}
                        onChange={(e) => updateEmailForm('queryTitle', e.target.value)}
                        placeholder="e.g. Following up on your recent order"
                        className="flex h-10 w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-300/30 focus:border-purple-400"
                      />
                      <p className="mt-1 text-[10px] text-zinc-400">Used as both the email subject line and the heading shown in the message.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Message *</label>
                      <textarea
                        required
                        rows={8}
                        value={emailForm.queryBody}
                        onChange={(e) => updateEmailForm('queryBody', e.target.value)}
                        placeholder={"Write the message body here. This appears after the greeting exactly as typed.\n\nLeave a blank line between paragraphs."}
                        className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-300/30 focus:border-purple-400 resize-y"
                      />
                    </div>
                  </>
                )}
                {emailType === 'success' && (
                  <>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">License Number <span className="text-[10px] text-zinc-400 italic font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={emailForm.licenseNumber}
                        onChange={(e) => updateEmailForm('licenseNumber', e.target.value)}
                        placeholder="e.g. 1234-5678-9012-345"
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Product Number <span className="text-[10px] text-zinc-400 italic font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={emailForm.productNumber}
                        onChange={(e) => updateEmailForm('productNumber', e.target.value)}
                        placeholder="e.g. 962-891"
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Type-specific fields */}
              {emailType === 'success' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                  <div>
                    <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Amount Paid ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={emailForm.amountUSD}
                      onChange={(e) => updateEmailForm('amountUSD', e.target.value)}
                      placeholder="22.05"
                      className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Payment Date</label>
                    <DateFilterInput
                      value={emailForm.paidAt}
                      onChange={(iso) => updateEmailForm('paidAt', iso)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Due Date <span className="text-zinc-300">(optional)</span></label>
                    <DateFilterInput
                      value={emailForm.receiptDueDate}
                      onChange={(iso) => updateEmailForm('receiptDueDate', iso)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                    />
                  </div>
                </div>
              ) : emailType === 'refund' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                  <div>
                    <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Refund Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={emailForm.refundAmountUSD}
                      onChange={(e) => updateEmailForm('refundAmountUSD', e.target.value)}
                      placeholder="22.05"
                      className="flex h-10 w-full rounded-md border border-sky-600 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-600/30 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Refund Date</label>
                    <DateFilterInput
                      value={emailForm.refundedAt}
                      onChange={(iso) => updateEmailForm('refundedAt', iso)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Reason <span className="text-[10px] text-zinc-400 italic font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={emailForm.refundReason}
                      onChange={(e) => updateEmailForm('refundReason', e.target.value)}
                      placeholder="e.g. Duplicate charge"
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-600"
                    />
                  </div>
                </div>
              ) : emailType === 'failed' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t pt-5 border-zinc-100">
                  <div>
                    <label className="block mb-1.5 font-semibold text-xs text-zinc-900">
                      {reminderGateway === 'shopifySubscription' ? 'Subscription Tier *' : 'Amount Due ($) *'}
                    </label>
                    {reminderGateway === 'shopifySubscription' ? (
                      <select
                        required
                        value={emailSubscriptionTier}
                        onChange={(e) => setEmailSubscriptionTier(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-amber-500 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-semibold cursor-pointer"
                      >
                        {EMAIL_SUBSCRIPTION_TIERS.map((tier) => (
                          <option key={tier} value={tier}>${tier} / month</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={emailForm.amountDueUSD}
                        onChange={(e) => updateEmailForm('amountDueUSD', e.target.value)}
                        placeholder="22.05"
                        className="flex h-10 w-full rounded-md border border-amber-500 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-semibold"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Due Date *</label>
                    <DateFilterInput
                      value={emailForm.dueDate}
                      onChange={(iso) => updateEmailForm('dueDate', iso)}
                      required
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Cancellation Date *</label>
                    <DateFilterInput
                      value={emailForm.cancellationDate}
                      onChange={(iso) => updateEmailForm('cancellationDate', iso)}
                      required
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>

                  <div className="md:col-span-3 bg-amber-50/60 rounded-lg p-4 border border-amber-200">
                    <label className="block mb-2 font-medium text-xs text-amber-700 uppercase tracking-wider">"Update now" button link</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white rounded-md border border-zinc-200 p-1">
                      <button
                        type="button"
                        onClick={() => setReminderGateway('')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === '' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Contact support
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderGateway('authorize')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === 'authorize' ? 'bg-[#0075ff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Authorize.net
                      </button>
                      {/* STRIPE CURRENTLY DISABLED
                      <button
                        type="button"
                        onClick={() => setReminderGateway('stripe')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === 'stripe' ? 'bg-[#635bff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Stripe
                      </button>
                      */}
                      {/* SHOPIFY CURRENTLY DISABLED — temporarily off as a payment gateway for
                          new "Update now" links (2026-10-16). Shopify Subscription is unaffected.
                      <button
                        type="button"
                        onClick={() => setReminderGateway('shopify')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === 'shopify' ? 'bg-[#95BF47] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Shopify
                      </button>
                      */}
                      {/* SHOPIFY SUBSCRIPTION CURRENTLY DISABLED — temporarily off alongside
                          plain Shopify above (2026-10-16).
                      <button
                        type="button"
                        onClick={() => setReminderGateway('shopifySubscription')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === 'shopifySubscription' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Shopify Subscription
                      </button>
                      */}
                      <button
                        type="button"
                        onClick={() => setReminderGateway('paydollar')}
                        className={`text-xs font-semibold py-2 px-1.5 rounded transition-colors cursor-pointer ${reminderGateway === 'paydollar' ? 'bg-[#e4002b] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        PayDollar
                      </button>
                    </div>

                    <p className="text-[10px] text-amber-700/80 mt-2 leading-relaxed">
                      {reminderGateway === 'shopifySubscription'
                        ? `"Update now" will open a real Shopify recurring checkout for $${emailSubscriptionTier}/month — "QuickBooks Payroll (Monthly Subscription)" — the customer logs in and subscribes like any other invoice link.`
                        : reminderGateway
                        ? `"Update now" will open a real ${reminderGateway === 'authorize' ? 'Authorize.net' : reminderGateway === 'paydollar' ? 'PayDollar' : 'Shopify'} checkout for $${emailForm.amountDueUSD || '0.00'} — labeled "${emailProductDisplayName}"${isEmailProductQbEdition ? ` (${emailUsers} user${emailUsers === 1 ? '' : 's'}, ${emailYears} year${emailYears === 1 ? '' : 's'})` : ''} — the customer logs in and pays like any other invoice link.`
                        : 'No gateway selected — "Update now" will just open a support email instead of a live checkout.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {singleSendPrior && (
                <div className={`rounded-lg p-3 border ${singleSendPrior.isRecent ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
                  <p className={`text-[11px] font-semibold flex items-center gap-1.5 ${singleSendPrior.isRecent ? 'text-red-700' : 'text-zinc-600'}`}>
                    {singleSendPrior.isRecent && <AlertCircle size={13} className="shrink-0" />}
                    {emailType === 'success' ? 'A receipt' : emailType === 'refund' ? 'A refund email' : emailType === 'survey' ? 'A survey email' : emailType === 'query' ? 'A message' : 'A reminder'} was already sent to this address on {singleSendPrior.label}
                    {singleSendPrior.isRecent ? ' — less than a week ago.' : '.'}
                  </p>
                </div>
              )}

              {singleDuplicateConfirming && (
                <div className="border border-red-300 bg-red-50 rounded-lg p-4">
                  <p className="text-xs font-bold text-red-900">Send it again anyway?</p>
                  <p className="text-[11px] text-red-800 mt-1">
                    This recipient already got {emailType === 'success' ? 'a receipt' : emailType === 'refund' ? 'a refund email' : emailType === 'survey' ? 'a survey email' : emailType === 'query' ? 'a message' : 'a reminder'} on {singleSendPrior?.label}. This cannot be undone.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={isSendingCustomEmail}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSendingCustomEmail ? 'Sending…' : 'Yes, send it again'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleDuplicateConfirming(false)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 font-bold rounded-lg text-xs cursor-pointer hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!singleDuplicateConfirming && (
                <button
                  type="submit"
                  disabled={isSendingCustomEmail}
                  className={`w-full py-2.5 disabled:bg-zinc-100 text-white disabled:text-zinc-400 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed border border-zinc-950/10 ${emailType === 'success' ? 'bg-[#2ca01c] hover:bg-[#248a18]' : emailType === 'refund' ? 'bg-sky-600 hover:bg-sky-700' : emailType === 'survey' ? 'bg-indigo-600 hover:bg-indigo-700' : emailType === 'query' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  {isSendingCustomEmail ? 'Sending...' : emailType === 'success' ? 'Send Payment Receipt' : emailType === 'refund' ? 'Send Refund Email' : emailType === 'survey' ? 'Send Survey Email' : emailType === 'query' ? 'Send Message' : 'Send Payment Reminder'}
                </button>
              )}
            </form>
          </div>
          </div>
        )}

        {/* Tab: Email Logs — every receipt/reminder ever sent, with delivery + engagement status */}
        {activeTab === 'sentEmails' && (
          <div className="space-y-8">
          {/* Sent Emails history */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs">
            <div className="p-6 md:p-8 pb-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Mail size={16} className="text-zinc-400" />
                  Sent Emails
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Every receipt and reminder ever sent, automatic or manual, with the data used to build it.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 min-w-[160px] md:flex-none">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={emailLogsSearch}
                    onChange={(e) => setEmailLogsSearch(e.target.value)}
                    placeholder="Search by email or name…"
                    className="pl-7 pr-3 py-1.5 border border-zinc-200 rounded-lg text-[11px] w-full md:w-48 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
                <select
                  value={emailLogsType}
                  onChange={(e) => setEmailLogsType(e.target.value)}
                  className="border border-zinc-200 rounded-lg text-[11px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
                >
                  <option value="">All types</option>
                  <option value="receipt">Receipt</option>
                  <option value="reminder">Reminder</option>
                  <option value="refund">Refund</option>
                  <option value="survey">Survey</option>
                  <option value="query">Query</option>
                </select>
                <select
                  value={emailLogsTrigger}
                  onChange={(e) => setEmailLogsTrigger(e.target.value)}
                  className="border border-zinc-200 rounded-lg text-[11px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
                >
                  <option value="">All sources</option>
                  <option value="admin-bulk">Bulk email</option>
                  <option value="admin-manual">Manual (Send Email tab)</option>
                  <option value="admin-order">Payment link order</option>
                  <option value="authorize-webhook">Authorize webhook</option>
                  <option value="authorize-sync">Authorize sync</option>
                  <option value="authorize-complete">Authorize complete</option>
                </select>
                <div className="flex items-center gap-1">
                  <DateFilterInput
                    value={emailLogsDateFrom}
                    onChange={setEmailLogsDateFrom}
                    maxIso={emailLogsDateTo || getTodayDateString('America/New_York')}
                    className="border border-zinc-200 rounded-lg text-[11px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-[90px]"
                  />
                  <span className="text-zinc-400 text-[10px]">to</span>
                  <DateFilterInput
                    value={emailLogsDateTo}
                    onChange={setEmailLogsDateTo}
                    maxIso={getTodayDateString('America/New_York')}
                    className="border border-zinc-200 rounded-lg text-[11px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-[90px]"
                  />
                </div>
                <select
                  value={emailLogsPerPage}
                  onChange={(e) => setEmailLogsPerPage(Number(e.target.value))}
                  className="border border-zinc-200 rounded-lg text-[11px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <button
                  type="button"
                  onClick={() => fetchEmailLogs(emailLogsPage)}
                  disabled={isLoadingEmailLogs}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-semibold rounded-lg text-[11px] whitespace-nowrap transition-colors shadow-xs bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isLoadingEmailLogs ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
            <p className="px-6 md:px-8 -mt-2 pb-2 text-[10px] text-zinc-400">
              MailPace and MailerSend rows update automatically once their webhook is configured — "Check delivery" only re-checks Resend-tracked rows.
            </p>

            {isLoadingEmailLogs ? (
              <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">Loading sent emails...</p>
            ) : emailLogsList.length === 0 ? (
              <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">
                {(emailLogsSearch.trim() || emailLogsTrigger || emailLogsType || emailLogsDateFrom || emailLogsDateTo)
                  ? 'No emails match these filters.'
                  : 'No emails have been sent yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-zinc-100 bg-zinc-50/60 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="py-2.5 px-4 font-semibold">Sent</th>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-4 font-semibold">Recipient</th>
                      <th className="py-2.5 px-4 font-semibold">Plan</th>
                      <th className="py-2.5 px-4 font-semibold">Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Trigger</th>
                      <th className="py-2.5 px-4 font-semibold">Provider</th>
                      <th className="py-2.5 px-4 font-semibold">Delivery</th>
                      <th className="py-2.5 px-4 font-semibold">Engagement</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {emailLogsList.map((entry) => (
                      <tr key={entry._id} className="hover:bg-zinc-50/40 transition-colors">
                        <td className="py-3 px-4 align-top whitespace-nowrap text-zinc-500">
                          {entry.sentAt ? formatDateMMDDYYYY(entry.sentAt, 'America/New_York') : 'N/A'}
                          <div className="text-[10px] text-zinc-400">{entry.sentAt ? new Date(entry.sentAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) + ' EST' : ''}</div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${entry.type === 'reminder' ? 'bg-amber-50 text-amber-700 border-amber-200' : entry.type === 'refund' ? 'bg-sky-50 text-sky-700 border-sky-200' : entry.type === 'query' ? 'bg-purple-50 text-purple-700 border-purple-200' : entry.type === 'survey' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {entry.type === 'reminder' ? 'REMINDER' : entry.type === 'refund' ? 'REFUND' : entry.type === 'query' ? 'QUERY' : entry.type === 'survey' ? 'SURVEY' : 'RECEIPT'}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-zinc-900">{entry.customerName || '—'}</div>
                          <div className="text-zinc-500">{entry.toEmail}</div>
                        </td>
                        <td className="py-3 px-4 align-top text-zinc-600 max-w-[220px] truncate" title={entry.planDetails}>{entry.planDetails || '—'}</td>
                        <td className="py-3 px-4 align-top font-semibold text-zinc-800">{entry.type !== 'query' && entry.type !== 'survey' && entry.amountUSD !== undefined && entry.amountUSD !== null ? `$${Number(entry.amountUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        <td className="py-3 px-4 align-top">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            {entry.trigger || 'unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${PROVIDER_STYLE[entry.provider] || 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                            {(entry.provider || 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setStatusPopover({
                                entry,
                                top: rect.bottom + 6,
                                left: Math.max(8, Math.min(rect.left, window.innerWidth - 348)),
                              })
                            }}
                            title="Click for details"
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer hover:brightness-95 ${DELIVERY_STATUS_STYLE[entry.deliveryStatus] || 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}
                          >
                            {(entry.deliveryStatus || 'unknown').toUpperCase()}
                          </button>
                        </td>
                        <td className="py-3 px-4 align-top">
                          {entry.clickedAt ? (
                            <span title={`Clicked ${entry.clickCount || 1}×${entry.lastClickedUrl ? ' — ' + entry.lastClickedUrl : ''}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                              CLICKED
                            </span>
                          ) : entry.openedAt ? (
                            <span title={`Opened ${entry.openCount || 1}×`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                              OPENED
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedEmailLog(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-blue-200 font-semibold rounded-md text-[10px] transition-colors shadow-xs bg-white hover:bg-blue-50 text-blue-700 cursor-pointer"
                          >
                            <Eye size={11} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoadingEmailLogs && emailLogsTotal > emailLogsPerPage && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-6 md:px-8 py-4">
                <button
                  type="button"
                  onClick={() => fetchEmailLogs(Math.max(emailLogsPage - 1, 1))}
                  disabled={emailLogsPage === 1}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-zinc-500 font-semibold bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200/50">
                  Page {emailLogsPage} of {Math.ceil(emailLogsTotal / emailLogsPerPage)} — {emailLogsTotal} email{emailLogsTotal === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => fetchEmailLogs(Math.min(emailLogsPage + 1, Math.ceil(emailLogsTotal / emailLogsPerPage)))}
                  disabled={emailLogsPage === Math.ceil(emailLogsTotal / emailLogsPerPage)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
          </div>
        )}

        {statusPopover && (() => {
          const e = statusPopover.entry
          const isFailure = FAILURE_DELIVERY_STATUSES.has(e.deliveryStatus)
          const reason = explainDeliveryFailure(e.deliveryStatus, e.deliveryDetail)
          const original = cleanDeliveryDetail(e.deliveryDetail)
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusPopover(null)} />
              <div
                className="fixed z-50 w-[340px] max-w-[calc(100vw-16px)] bg-white border border-zinc-200 rounded-xl shadow-xl p-4 text-xs"
                style={{ top: statusPopover.top, left: statusPopover.left }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${DELIVERY_STATUS_STYLE[e.deliveryStatus] || 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                    {(e.deliveryStatus || 'unknown').toUpperCase()}
                  </span>
                  <button type="button" onClick={() => setStatusPopover(null)} className="text-zinc-400 hover:text-zinc-800 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>

                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Reason</p>
                <p className={`font-medium leading-relaxed ${isFailure ? 'text-red-700' : 'text-zinc-800'}`}>
                  {reason || DELIVERY_STATUS_HINT[e.deliveryStatus] || 'No further detail from the provider.'}
                </p>

                {original && (
                  <>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3 mb-1">Original message</p>
                    <p className="font-mono text-[10px] text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-md p-2 break-words">
                      {original}
                    </p>
                  </>
                )}

                {e.statusUpdatedAt && (
                  <p className="text-[10px] text-zinc-400 mt-3">
                    Updated {new Date(e.statusUpdatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
                  </p>
                )}
              </div>
            </>
          )
        })()}

        {selectedEmailLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative flex flex-col" style={{ maxHeight: '90vh' }}>
              <button
                onClick={() => setSelectedEmailLog(null)}
                className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-800 transition-colors p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-zinc-200"
              >
                <X size={20} />
              </button>

              <div className="overflow-y-auto flex-1 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-bold text-zinc-900">Email Data Used</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${selectedEmailLog.type === 'reminder' ? 'bg-amber-50 text-amber-700 border-amber-200' : selectedEmailLog.type === 'refund' ? 'bg-sky-50 text-sky-700 border-sky-200' : selectedEmailLog.type === 'query' ? 'bg-purple-50 text-purple-700 border-purple-200' : selectedEmailLog.type === 'survey' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {selectedEmailLog.type === 'reminder' ? 'REMINDER' : selectedEmailLog.type === 'refund' ? 'REFUND' : selectedEmailLog.type === 'query' ? 'QUERY' : selectedEmailLog.type === 'survey' ? 'SURVEY' : 'RECEIPT'}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    ['Sent at', selectedEmailLog.sentAt ? new Date(selectedEmailLog.sentAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST' : 'N/A'],
                    ['Subject', selectedEmailLog.subject],
                    ['Recipient email', selectedEmailLog.toEmail],
                    ['Customer name', selectedEmailLog.customerName],
                    ['Order ID', selectedEmailLog.orderId],
                    ['Plan details', selectedEmailLog.planDetails],
                    ['Amount (USD)', selectedEmailLog.type !== 'query' && selectedEmailLog.type !== 'survey' && selectedEmailLog.amountUSD !== undefined && selectedEmailLog.amountUSD !== null ? `$${Number(selectedEmailLog.amountUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined],
                    ['Trigger', selectedEmailLog.trigger],
                    ['Record ID', selectedEmailLog._id],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-zinc-50 pb-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 pt-0.5">{label}</span>
                      <span className="font-medium text-zinc-800 text-right break-words">{value || <span className="text-zinc-300 italic">Not provided</span>}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedEmailLog(null)}
                  className="px-5 py-2 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm text-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const MobileLogCard = ({ log, downloadPDF }: { log: any, downloadPDF: (log: any) => void }) => {
  const [expanded, setExpanded] = useState(false)

  if (log.logType === 'user_session') {
    return (
      <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-xs hover:border-blue-300 transition-colors">
        <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div>
            <span className="text-[9px] uppercase font-bold text-blue-400 block tracking-wider">
              {formatDateMMDDYYYY(log.agreedTimestamp, 'America/New_York')}
            </span>
            <h4 className="font-semibold text-blue-900 text-base mt-0.5">Activity Session</h4>
            <p className="text-xs text-zinc-500 font-medium">{log.email || log.ipAddress}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Tracked
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs hover:border-zinc-300 transition-colors">
      <div 
        className="flex justify-between items-start cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-semibold text-emerald-800 flex items-center gap-2 mt-0.5">
            <CheckCircle size={14} className="text-emerald-600" />
            {formatDateMMDDYYYY(log.agreedTimestamp, 'America/New_York')}
          </div>
          <h4 className="font-semibold text-zinc-900 text-base mt-0.5">{log.firstName} {log.lastName}</h4>
          <p className="text-xs text-zinc-500 font-medium">{log.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {log.status === 'Completed' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
          )}
          <div className="text-sm font-extrabold text-[#2ca01c]">
            ${Number(log.amountUSD || log.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-zinc-100 pt-4 space-y-4 animate-in fade-in duration-200">
          <div className="text-[11px] text-zinc-600 bg-zinc-50 p-2.5 border border-zinc-200/50 rounded-lg">
            <span className="font-bold text-zinc-700 block text-[9px] uppercase tracking-wider mb-1">Plan Details</span>
            {log.planDetails}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadPDF(log); }}
              disabled={log.status !== 'Completed'}
              className={`w-full flex items-center justify-center gap-2 py-2.5 font-bold rounded-lg text-xs transition-colors border border-zinc-950/10 shadow-sm ${log.status === 'Completed' ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-50 cursor-pointer' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
            >
              <FileText size={14} />
              {log.status === 'Completed' ? 'Download PDF Receipt' : 'Awaiting Payment'}
            </button>
          </div>
        </div>
      )}

      <div 
        className="mt-3 flex items-center justify-center gap-1.5 border-t border-zinc-50 pt-3 cursor-pointer text-[10px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-wider"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <><ChevronUp size={12} /> View Less</>
        ) : (
          <><ChevronDown size={12} /> View Details</>
        )}
      </div>
    </div>
  )
}
