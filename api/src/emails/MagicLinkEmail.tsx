import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Preview,
  Hr,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  magicLinkUrl: string;
  companyName: string;
}

export function MagicLinkEmail({ magicLinkUrl, companyName }: MagicLinkEmailProps) {
  return (
    <Html lang="fi">
      <Head />
      <Preview>Kirjaudu AI-Sanomat-portaaliin</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={logoStyle}>AI-Sanomat</Text>
            <Text style={subtitleStyle}>{companyName}</Text>
          </Section>

          {/* Content */}
          <Section style={contentSectionStyle}>
            <Text style={paragraphStyle}>
              Hei! Klikkaa alla olevaa painiketta kirjautuaksesi AI-Sanomat-portaaliin.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSectionStyle}>
            <Button href={magicLinkUrl} style={buttonStyle}>
              Kirjaudu sisaan
            </Button>
          </Section>

          {/* Expiry note */}
          <Section style={contentSectionStyle}>
            <Text style={expiryStyle}>
              Linkki vanhenee 15 minuutin kuluttua.
            </Text>
          </Section>

          <Hr style={hrStyle} />

          {/* Security footer */}
          <Section style={footerSectionStyle}>
            <Text style={footerTextStyle}>
              Jos et pyytanyt tata linkkia, voit jattaa taman viestin huomiotta.
            </Text>
            <Text style={footerTextStyle}>
              AI-Sanomat - Tekoalyuutiset yrityksellesi
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// -- Styles --

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f6f6f6',
  fontFamily: 'Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
};

const headerStyle: React.CSSProperties = {
  padding: '24px 20px 16px',
  textAlign: 'center' as const,
};

const logoStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#111111',
  margin: '0 0 4px',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666666',
  margin: '0',
};

const contentSectionStyle: React.CSSProperties = {
  padding: '16px 20px',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 12px',
};

const buttonSectionStyle: React.CSSProperties = {
  padding: '8px 20px 16px',
  textAlign: 'center' as const,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  padding: '12px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
};

const expiryStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#666666',
  textAlign: 'center' as const,
  margin: '0',
};

const hrStyle: React.CSSProperties = {
  borderTop: '1px solid #dddddd',
  margin: '16px 20px',
};

const footerSectionStyle: React.CSSProperties = {
  padding: '16px 20px 24px',
  textAlign: 'center' as const,
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  margin: '0 0 8px',
};

export default MagicLinkEmail;
