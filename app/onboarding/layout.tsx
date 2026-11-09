import { UiTranslator } from '../../components/ui-language';

// Traduce la pantalla al idioma elegido (español, inglés o portugués).
export default function OnboardingLayout({children}:{children:React.ReactNode}) { return <>{children}<UiTranslator/></>; }
