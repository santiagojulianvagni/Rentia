import LandingPage, { landingMetadata } from '../components/site/landing-page';
import './landing-v2.css';

export const metadata = landingMetadata('es');

export default function Home() {
  return <LandingPage lang="es"/>;
}
