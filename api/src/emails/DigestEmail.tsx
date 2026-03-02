import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Img,
  Link,
  Hr,
  Preview,
} from '@react-email/components';
import type { DigestStory } from '../types/digest.js';

export interface DigestEmailStory extends DigestStory {
  imageUrl?: string;
}

export interface DigestEmailDigest {
  intro: string;
  stories: DigestEmailStory[];
  closing: string;
}

export interface DigestEmailProps {
  clientName: string;
  digest: DigestEmailDigest;
  heroImageUrl: string | null;
  unsubscribeUrl: string;
  trackingPixelUrl?: string;
}

export function DigestEmail({
  clientName,
  digest,
  heroImageUrl,
  unsubscribeUrl,
  trackingPixelUrl,
}: DigestEmailProps) {
  const previewText = digest.intro.slice(0, 100);

  return (
    <Html lang="fi">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={logoStyle}>AI-Sanomat</Text>
            <Text style={subtitleStyle}>{clientName}</Text>
          </Section>

          {/* Hero image */}
          {heroImageUrl && (
            <Section>
              <Img
                src={heroImageUrl}
                alt="Viikkokatsauksen kuva"
                width="600"
                style={heroImageStyle}
              />
            </Section>
          )}

          {/* Intro */}
          <Section style={contentSectionStyle}>
            <Text style={paragraphStyle}>{digest.intro}</Text>
          </Section>

          {/* Stories */}
          {digest.stories.map((story, index) => (
            <Section key={index} style={contentSectionStyle}>
              {story.imageUrl && (
                <Img
                  src={story.imageUrl}
                  alt={story.title}
                  width="560"
                  style={storyImageStyle}
                />
              )}
              <Text style={storyTitleStyle}>{story.title}</Text>
              <Text style={paragraphStyle}>{story.businessImpact}</Text>
              <Link href={story.sourceUrl} style={linkStyle}>
                Lue lisaa
              </Link>
            </Section>
          ))}

          {/* Closing */}
          <Section style={contentSectionStyle}>
            <Hr style={hrStyle} />
            <Text style={paragraphStyle}>{digest.closing}</Text>
          </Section>

          {/* Footer */}
          <Section style={footerSectionStyle}>
            <Text style={footerTextStyle}>
              AI-Sanomat - Tekoalyuutiset yrityksellesi
            </Text>
            <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
              Peruuta tilaus
            </Link>
          </Section>

          {/* Tracking pixel */}
          {trackingPixelUrl && (
            <Img
              src={trackingPixelUrl}
              alt=""
              width="1"
              height="1"
              style={trackingPixelStyle}
            />
          )}
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

const heroImageStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
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

const storyImageStyle: React.CSSProperties = {
  width: '560px',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '8px',
  display: 'block',
  marginBottom: '12px',
};

const storyTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#111111',
  margin: '0 0 8px',
};

const linkStyle: React.CSSProperties = {
  color: '#0066cc',
  fontSize: '16px',
  textDecoration: 'underline',
};

const hrStyle: React.CSSProperties = {
  borderTop: '1px solid #dddddd',
  margin: '16px 0',
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

const unsubscribeLinkStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  textDecoration: 'underline',
};

const trackingPixelStyle: React.CSSProperties = {
  border: 'none',
  display: 'block',
};

export default DigestEmail;
