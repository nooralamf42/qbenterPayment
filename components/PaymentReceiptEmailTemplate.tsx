import React from 'react';

export default function PaymentReceipt({ 
  customerEmail = "john.doe@example.com",
  transactionId = "TXN-2024-001234",
  amount = "149.99",
  currency = "USD",
  paymentDate = "July 4, 2025",
  cardLastFourDigits = "1234",
  cardExpiryDate = "12/28",
  billingAddress = {
    street: "123 Main Street",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    country: "United States"
  },
  description = "Monthly subscription payment"
}) {
  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '24px',
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '16px',
        marginBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '8px',
          margin: '0 0 8px 0'
        }}>Payment Receipt</h1>
        <span style={{
          display: 'inline-block',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          ✓ PAYMENT SUCCESSFUL
        </span>
      </div>

      {/* Amount */}
      <div style={{
        textAlign: 'center',
        backgroundColor: '#f0fdf4',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#059669'
        }}>
          {currency} {amount}
        </div>
      </div>

      {/* Transaction Details */}
      <div style={{ marginBottom: '24px' }}>
        {/* <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <span style={{ fontWeight: '500', color: '#6b7280' }}>Transaction ID:</span>
          <span style={{ color: '#1f2937' }}>{transactionId}</span>
        </div> */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <span style={{ fontWeight: '500', color: '#6b7280' }}>Date:</span>
          <span style={{ color: '#1f2937' }}>{paymentDate}</span>
        </div>
        {/* name */}
        {/* <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <span style={{ fontWeight: '500', color: '#6b7280' }}>Customer:</span>
          <span style={{ color: '#1f2937' }}>{customerName}</span>
        </div> */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <span style={{ fontWeight: '500', color: '#6b7280' }}>Email:</span>
          <span style={{ color: '#1f2937' }}>{customerEmail}</span>
        </div>
        {/* description */}
        {/* {description && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0'
          }}>
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Description:</span>
            <span style={{ color: '#1f2937' }}>{description}</span>
          </div>
        )} */}
      </div>

      {/* Payment Method */}
      <div style={{
        backgroundColor: '#eff6ff',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontWeight: '600',
          color: '#1e40af',
          marginBottom: '12px',
          margin: '0 0 12px 0'
        }}>Payment Method</h3>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 0'
        }}>
          <span style={{ color: '#6b7280' }}>Card Number:</span>
          <span style={{ color: '#1f2937' }}>**** **** **** {cardLastFourDigits}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 0'
        }}>
          <span style={{ color: '#6b7280' }}>Expires:</span>
          <span style={{ color: '#1f2937' }}>{cardExpiryDate}</span>
        </div>
      </div>

      {/* Billing Address */}
      <div style={{
        backgroundColor: '#fffbeb',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontWeight: '600',
          color: '#d97706',
          marginBottom: '12px',
          margin: '0 0 12px 0'
        }}>Billing Address</h3>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span style={{ color: '#6b7280' }}>Street:</span>
            <span style={{ color: '#1f2937' }}>{billingAddress.street}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span style={{ color: '#6b7280' }}>City:</span>
            <span style={{ color: '#1f2937' }}>{billingAddress.city}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span style={{ color: '#6b7280' }}>State:</span>
            <span style={{ color: '#1f2937' }}>{billingAddress.state}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span style={{ color: '#6b7280' }}>ZIP Code:</span>
            <span style={{ color: '#1f2937' }}>{billingAddress.zipCode}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span style={{ color: '#6b7280' }}>Country:</span>
            <span style={{ color: '#1f2937' }}>{billingAddress.country}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb',
        color: '#6b7280'
      }}>
        <p style={{ marginBottom: '8px' }}>Thank you for your payment!</p>
        <p style={{ fontSize: '14px' }}>If you have any questions about this receipt, please contact our support team.</p>
      </div>
    </div>
  );
}