import React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
  Hr,
  Tailwind,
} from '@react-email/components';
import { pixelBasedPreset } from '@react-email/components';
import type { DigestStory } from '../types/digest.js';
import type { FeaturedPost } from '../types/digest.js';

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
  clientIndustry: string;
  digest: DigestEmailDigest;
  heroImageUrl: string | null;
  featuredPosts: FeaturedPost[];
  feedbackUrls?: { up: string; down: string };
  unsubscribeUrl: string;
  trackingPixelUrl?: string;
}

export function DigestEmail({
  clientName,
  clientIndustry,
  digest,
  heroImageUrl,
  featuredPosts,
  feedbackUrls,
  unsubscribeUrl,
  trackingPixelUrl,
}: DigestEmailProps) {
  const previewText = digest.intro.slice(0, 100);

  return (
    <Html lang="fi">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: '#0D9488',
              },
            },
          },
        }}
      >
        <Head>
          <meta content="light dark" name="color-scheme" />
          <meta content="light dark" name="supported-color-schemes" />
          <style>{`
            :root { color-scheme: light dark; }
            @media (prefers-color-scheme: dark) {
              .email-body { background-color: #1a1a1a !important; }
              .email-container { background-color: #262626 !important; }
              .email-text { color: #e5e5e5 !important; }
              .email-heading { color: #f5f5f5 !important; }
              .email-subheading { color: #d4d4d4 !important; }
              .email-muted { color: #a3a3a3 !important; }
              .email-footer { color: #a3a3a3 !important; }
              .email-divider { border-color: #404040 !important; }
              .email-brand-bar { background-color: #0D9488 !important; }
              .email-featured-bg { background-color: #1f2937 !important; }
              .email-link { color: #2dd4bf !important; }
            }
          `}</style>
        </Head>
        <Preview>{previewText}</Preview>
        <Body className="bg-[#F7F7F7] font-sans email-body" style={{ margin: 0, padding: 0 }}>
          <Container className="max-w-[600px] mx-auto bg-white my-[32px] rounded-lg overflow-hidden email-container">

            {/* BRAND HEADER */}
            <Section className="pt-[32px] pb-[16px] px-[24px] text-center">
              <Text className="text-[30px] font-bold text-[#111111] m-0 email-heading">
                AI-Sanomat
              </Text>
              <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
                {clientName} | {clientIndustry}
              </Text>
            </Section>

            {/* TEAL ACCENT BAR */}
            <Section style={{ height: '4px', backgroundColor: '#0D9488' }} className="email-brand-bar" />

            {/* HERO IMAGE */}
            {heroImageUrl && (
              <Section>
                <Img
                  src={heroImageUrl}
                  alt="Viikkokatsauksen kuva"
                  width="600"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </Section>
            )}

            {/* INTRO */}
            <Section className="px-[24px] pt-[24px] pb-[8px]">
              <Text className="text-[16px] leading-relaxed text-[#333333] m-0 email-text">
                {digest.intro}
              </Text>
            </Section>

            {/* STORIES */}
            {digest.stories.map((story, i) => (
              <Section key={i} className="px-[24px] py-[16px]">
                {story.imageUrl && (
                  <Img
                    src={story.imageUrl}
                    alt={story.title}
                    width="552"
                    style={{
                      width: '100%',
                      maxWidth: '552px',
                      height: 'auto',
                      borderRadius: '8px',
                      display: 'block',
                      marginBottom: '12px',
                    }}
                  />
                )}
                <Text className="text-[20px] font-bold text-[#111111] m-0 mb-[8px] email-heading">
                  {story.title}
                </Text>
                <Text className="text-[16px] leading-relaxed text-[#333333] m-0 mb-[8px] email-text">
                  {story.businessImpact}
                </Text>
                <Link
                  href={story.sourceUrl}
                  className="text-[#0D9488] text-[16px] no-underline email-link"
                >
                  Lue lisaa &rarr;
                </Link>
                {i < digest.stories.length - 1 && (
                  <Hr
                    style={{ borderTop: '1px solid #EEEEEE', margin: '16px 0 0' }}
                    className="email-divider"
                  />
                )}
              </Section>
            ))}

            {/* CLOSING */}
            <Section className="px-[24px] py-[16px]">
              <Hr
                style={{ borderTop: '1px solid #EEEEEE', margin: '0 0 8px' }}
                className="email-divider"
              />
              <Text className="text-[16px] leading-relaxed text-[#333333] m-0 email-text">
                {digest.closing}
              </Text>
            </Section>

            {/* FEEDBACK (only if feedbackUrls provided) */}
            {feedbackUrls && (
              <Section className="px-[24px] py-[24px] text-center">
                <Text className="text-[16px] text-[#555555] m-0 mb-[12px] email-text">
                  Oliko tama katsaus hyodyllinen?
                </Text>
                <Link href={feedbackUrls.up} className="text-[24px] no-underline" style={{ marginRight: '16px' }}>
                  {'👍'}
                </Link>
                <Link href={feedbackUrls.down} className="text-[24px] no-underline" style={{ marginLeft: '16px' }}>
                  {'👎'}
                </Link>
              </Section>
            )}

            {/* FEATURED SECTION: "AI-Sanomat suosittelee" */}
            {featuredPosts.length > 0 && (
              <Section className="px-[24px] pt-[24px] pb-[8px] bg-[#F9FAFB] email-featured-bg">
                <Text className="text-[12px] font-bold text-[#0D9488] uppercase tracking-widest m-0 mb-[16px]">
                  AI-Sanomat suosittelee
                </Text>
                {featuredPosts.map((post, i) => (
                  <Section key={i} className="mb-[16px]">
                    <Link
                      href={post.url}
                      className="text-[16px] font-semibold text-[#111111] no-underline email-heading"
                    >
                      {post.title}
                    </Link>
                    {post.summary && (
                      <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
                        {post.summary}
                      </Text>
                    )}
                  </Section>
                ))}
              </Section>
            )}

            {/* FOOTER */}
            <Section className="px-[24px] py-[24px] text-center bg-[#F7F7F7] email-footer">
              <Text className="text-[14px] font-bold text-[#333333] m-0 mb-[4px] email-text">
                AI-Sanomat
              </Text>
              <Text className="text-[12px] text-[#999999] m-0 mb-[12px] email-muted">
                Tekoalyuutiset yrityksellesi — viikoittain
              </Text>
              <Link
                href="https://aisanomat.fi"
                className="text-[12px] text-[#0D9488] email-link"
                style={{ marginRight: '16px' }}
              >
                aisanomat.fi
              </Link>
              <Link
                href="https://x.com/aisanomat"
                className="text-[12px] text-[#0D9488] email-link"
                style={{ marginRight: '16px' }}
              >
                X
              </Link>
              <Link
                href="https://linkedin.com/company/aisanomat"
                className="text-[12px] text-[#0D9488] email-link"
              >
                LinkedIn
              </Link>
              <Hr
                style={{ borderTop: '1px solid #EEEEEE', margin: '16px 0' }}
                className="email-divider"
              />
              <Text className="text-[12px] text-[#999999] m-0 email-muted">
                AI-Sanomat Oy | Helsinki, Suomi
              </Text>
              <Link href={unsubscribeUrl} className="text-[12px] text-[#999999] underline email-muted">
                Peruuta tilaus
              </Link>
            </Section>

            {/* TRACKING PIXEL */}
            {trackingPixelUrl && (
              <Img
                src={trackingPixelUrl}
                alt=""
                width="1"
                height="1"
                style={{ border: 'none', display: 'block' }}
              />
            )}

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default DigestEmail;
