import { UiTranslator } from '../../components/ui-language';

// Traduce la pantalla al idioma elegido (español, inglés o portugués).
export default function RegistroLayout({children}:{children:React.ReactNode}) { return <>{children}<UiTranslator/></>; }
