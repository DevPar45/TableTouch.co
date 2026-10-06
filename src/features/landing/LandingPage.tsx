'use client';
import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { HowItWorks } from './HowItWorks';
import { CardShowcase } from './CardShowcase';
import { BenefitsSection } from './BenefitsSection';
import { PricingSection } from './PricingSection';
import { ClosingSection } from './ClosingSection';
export function LandingPage(){return <main className="landing"><LandingNav/><LandingHero/><HowItWorks/><CardShowcase/><BenefitsSection/><PricingSection/><ClosingSection/></main>}
