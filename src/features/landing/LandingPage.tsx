'use client';
import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { JourneyOverview } from './JourneyOverview';
import { ClosingSection } from './ClosingSection';
import { LandingDock } from './LandingDock';

export function LandingPage(){return <main className="landing"><LandingNav/><LandingHero/><JourneyOverview/><ClosingSection/><LandingDock/></main>}
