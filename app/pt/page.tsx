import LandingPage, { landingMetadata } from '../../components/site/landing-page';
import '../landing-v2.css';

export const metadata = landingMetadata('pt');

export default function HomePortuguese() {
  return <LandingPage lang="pt"/>;
}
