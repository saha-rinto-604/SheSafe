// Old sos_screen route — redirects to the new canonical location in users/
import { Redirect } from 'expo-router';

export default function SosLegacyRedirect() {
    return <Redirect href="/users/sos_screen" />;
}