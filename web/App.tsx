import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { MAX_TEXT_LENGTH } from '../src/contract';
import type { FeedbackRecord } from '../src/contract';
import { fetchRecords, submitFeedback } from './api';

function countBy(records: FeedbackRecord[], field: 'category' | 'severity'): [string, number][] {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record[field], (counts.get(record[field]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1.0625rem' }}>
      {children}
    </Typography>
  );
}

function CountCard({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No feedback yet.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {entries.map(([value, count]) => (
              <Stack key={value} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {value.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function App() {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await fetchRecords());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not reach the service.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitFeedback(text);
      setText('');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit the feedback.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h5">Feedback intake</Typography>

        <Stack spacing={1}>
          <SectionTitle>Submit feedback</SectionTitle>
          <TextField
            label="Feedback"
            placeholder="Tell us what happened…"
            multiline
            minRows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_TEXT_LENGTH } }}
            disabled={busy}
          />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Button variant="contained" onClick={() => void submit()} disabled={busy || text.trim() === ''}>
              Submit
            </Button>
            {busy && <CircularProgress size={20} />}
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack spacing={1}>
          <SectionTitle>Overview</SectionTitle>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CountCard title="By category" entries={countBy(records, 'category')} />
            <CountCard title="By severity" entries={countBy(records, 'severity')} />
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <SectionTitle>Records</SectionTitle>
          <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary' } }}>
                <TableCell>Submitted</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Sentiment</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Suggested action</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No feedback yet.</TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{new Date(record.submittedAt).toLocaleString()}</TableCell>
                    <TableCell>{record.category}</TableCell>
                    <TableCell>{record.sentiment}</TableCell>
                    <TableCell>{record.severity}</TableCell>
                    <TableCell>{record.summary}</TableCell>
                    <TableCell>{record.suggestedAction}</TableCell>
                    <TableCell>{record.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </TableContainer>
        </Stack>
      </Stack>
    </Container>
  );
}
