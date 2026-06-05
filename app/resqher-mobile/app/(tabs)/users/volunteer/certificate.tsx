import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { incidentService, type VolunteerCertificateData } from '../../../../src/services/incidentService';
import {
    CERTIFICATE_PAGE,
    getVolunteerCertificateHtml,
    shareVolunteerCertificatePdf,
} from '../../../../src/utils/generateVolunteerCertificate';

export default function VolunteerCertificateScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [data, setData] = useState<VolunteerCertificateData | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCertificateData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await incidentService.getVolunteerCertificateData();
            if (!result?.name) {
                throw new Error('Certificate data missing');
            }
            setData(result);
            setError(null);
        } catch (err) {
            console.error('Certificate preview failed:', err);
            setError('Could not load your certificate right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCertificateData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadCertificateData]);

    const html = useMemo(() => (
        data ? getVolunteerCertificateHtml(data) : ''
    ), [data]);

    const handleDownload = useCallback(async () => {
        if (!data || downloading) return;

        try {
            setDownloading(true);
            const result = await shareVolunteerCertificatePdf(data);
            if (result.numberOfPages > 1) {
                console.warn('[CERTIFICATE] PDF rendered with pages:', result.numberOfPages);
            }
        } catch (err) {
            console.error('Certificate download failed:', err);
            Alert.alert('Certificate Error', 'Could not prepare your certificate download right now.');
        } finally {
            setDownloading(false);
        }
    }, [data, downloading]);

    return (
        <AtmosphericShell>
            <View style={[s.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={s.header}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.7}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <View style={s.headerTitleArea}>
                        <Text style={s.headerTitle}>Volunteer Certificate</Text>
                    </View>
                    <View style={s.headerRightSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={s.stateCard}>
                            <ActivityIndicator color={T.violet} />
                            <Text style={s.stateTitle}>Loading certificate</Text>
                        </View>
                    ) : error ? (
                        <View style={s.stateCard}>
                            <Feather name="alert-circle" size={24} color={T.danger} />
                            <Text style={s.stateTitle}>{error}</Text>
                            <TouchableOpacity style={s.retryBtn} onPress={loadCertificateData} activeOpacity={0.85}>
                                <Text style={s.retryText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : data ? (
                        <>
                            <View style={s.previewCard}>
                                <View style={s.previewHeader}>
                                    <View style={s.previewIcon}>
                                        <Feather name="award" size={18} color={T.violet} />
                                    </View>
                                    <View style={s.previewTitleWrap}>
                                        <Text style={s.previewTitle}>Certificate Preview</Text>
                                        <Text style={s.previewMeta}>
                                            {data.assistedIncidents} helped | {data.totalPoints} pts
                                        </Text>
                                    </View>
                                </View>

                                <View style={s.webFrame}>
                                    <WebView
                                        originWhitelist={['*']}
                                        source={{ html }}
                                        style={s.webView}
                                        scrollEnabled={false}
                                        showsHorizontalScrollIndicator={false}
                                        showsVerticalScrollIndicator={false}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[s.downloadBtn, downloading && s.downloadBtnDisabled]}
                                onPress={handleDownload}
                                disabled={downloading}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={[T.violet, '#7C3AED']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={s.downloadFill}
                                >
                                    {downloading ? (
                                        <ActivityIndicator color={T.onPrimary} />
                                    ) : (
                                        <Feather name="download" size={18} color={T.onPrimary} />
                                    )}
                                    <Text style={s.downloadText}>
                                        {downloading ? 'Preparing PDF...' : 'Download Certificate'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    ) : null}
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleArea: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: 0,
    },
    headerRightSpacer: {
        width: 36,
        height: 36,
    },
    content: {
        paddingHorizontal: 14,
        paddingTop: 16,
        gap: 14,
    },
    stateCard: {
        minHeight: 220,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: T.surfaceBulky,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22,
        gap: 12,
    },
    stateTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: T.ink,
        textAlign: 'center',
    },
    retryBtn: {
        minHeight: 42,
        paddingHorizontal: 20,
        borderRadius: R.pill,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}40`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: {
        color: T.violet,
        fontSize: 13,
        fontWeight: '800',
    },
    previewCard: {
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: T.surfaceBulky,
        padding: 12,
        gap: 12,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewIcon: {
        width: 36,
        height: 36,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        backgroundColor: T.violetDim,
    },
    previewTitleWrap: {
        flex: 1,
    },
    previewTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: 0,
    },
    previewMeta: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
    },
    webFrame: {
        width: '100%',
        aspectRatio: CERTIFICATE_PAGE.width / CERTIFICATE_PAGE.height,
        overflow: 'hidden',
        borderRadius: R.sm,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    webView: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    downloadBtn: {
        borderRadius: R.pill,
        overflow: 'hidden',
        minHeight: 50,
    },
    downloadBtnDisabled: {
        opacity: 0.72,
    },
    downloadFill: {
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        paddingHorizontal: 18,
    },
    downloadText: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0,
    },
});
