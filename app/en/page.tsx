import LandingPage, { landingMetadata } from '../../components/site/landing-page';
import '../landing-v2.css';

export const metadata = landingMetadata('en');

export default function HomeEnglish() {
  return <LandingPage lang="en"/>;
}
