
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { TicketModal } from '@/components/tickets/TicketModal';
import { Ticket, TicketStatus, Role, UserProfile, TicketPriority } from '@/types';
import { ticketService, userService } from '@/services/api';
import { PlusIcon, EditIcon, EyeIcon, DeleteIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import {