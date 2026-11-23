import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { MediaTypeDto } from '../users/dto/users.dto';
import {
  AddCollectionItemDto,
  AddGroupMembersDto,
  CreateCollectionDto,
  CreateGroupDto,
  EditMessageDto,
  SendFriendRequestDto,
  SendMessageDto,
  ToggleReactionDto,
  UpsertRatingDto,
} from './dto/social.dto';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // --- Public Profile Showcase (viewable by friends via /user/[id]) ---

  @Get('users/:userId/profile')
  getPublicShowcase(@Param('userId') userId: string) {
    return this.socialService.getPublicShowcase(userId);
  }

  @Get('movies/:tmdbId/reviews')
  getMediaReviews(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('mediaType') mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
  ) {
    return this.socialService.getMediaReviews(tmdbId, mediaType);
  }

  // --- Friends (protected) ---

  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  searchUsers(@CurrentUser() user: AuthenticatedUser, @Query('q') q = '') {
    return this.socialService.searchUsers(user.userId, q);
  }

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  getFriends(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getFriendsOverview(user.userId);
  }

  @Post('friends/request')
  @UseGuards(JwtAuthGuard)
  sendFriendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.socialService.sendFriendRequest(user.userId, dto);
  }

  @Post('friends/:requestId/accept')
  @UseGuards(JwtAuthGuard)
  acceptFriendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    return this.socialService.acceptFriendRequest(user.userId, requestId);
  }

  @Delete('friends/:friendshipId')
  @UseGuards(JwtAuthGuard)
  removeFriendship(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.socialService.removeFriendship(user.userId, friendshipId);
  }

  @Post('friends/:targetUserId/block')
  @UseGuards(JwtAuthGuard)
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.blockUser(user.userId, targetUserId);
  }

  // --- My Shared Ratings & Favorites (protected) ---

  @Get('ratings/me')
  @UseGuards(JwtAuthGuard)
  getMyRatings(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getUserRatings(user.userId);
  }

  @Post('ratings')
  @UseGuards(JwtAuthGuard)
  upsertRating(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertRatingDto) {
    return this.socialService.upsertRating(user.userId, dto);
  }

  @Delete('ratings/:tmdbId')
  @UseGuards(JwtAuthGuard)
  deleteRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('mediaType') mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
  ) {
    return this.socialService.deleteRating(user.userId, tmdbId, mediaType);
  }

  // --- Custom Collections (Letterboxd-style Lists) ---

  @Get('collections/me')
  @UseGuards(JwtAuthGuard)
  getMyCollections(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getUserCollections(user.userId);
  }

  @Post('collections')
  @UseGuards(JwtAuthGuard)
  createCollection(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCollectionDto) {
    return this.socialService.createCollection(user.userId, dto);
  }

  @Delete('collections/:id')
  @UseGuards(JwtAuthGuard)
  deleteCollection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.socialService.deleteCollection(user.userId, id);
  }

  @Post('collections/:id/items')
  @UseGuards(JwtAuthGuard)
  addCollectionItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddCollectionItemDto,
  ) {
    return this.socialService.addCollectionItem(user.userId, id, dto);
  }

  @Delete('collections/:id/items/:tmdbId')
  @UseGuards(JwtAuthGuard)
  removeCollectionItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('mediaType') mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
  ) {
    return this.socialService.removeCollectionItem(user.userId, id, tmdbId, mediaType);
  }

  // --- Direct Messenger with Friends ---

  @Get('messages/unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadMessageCount(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getUnreadMessageCount(user.userId);
  }

  @Get('messages/conversations')
  @UseGuards(JwtAuthGuard)
  getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getConversations(user.userId);
  }

  @Get('messages/:friendId')
  @UseGuards(JwtAuthGuard)
  getMessagesWithFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId') friendId: string,
  ) {
    return this.socialService.getMessagesWithFriend(user.userId, friendId);
  }

  @Post('messages/:friendId')
  @UseGuards(JwtAuthGuard)
  sendMessageToFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId') friendId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.socialService.sendMessageToFriend(user.userId, friendId, dto);
  }

  @Post('messages/:friendId/typing')
  @UseGuards(JwtAuthGuard)
  setTypingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId') friendId: string,
  ) {
    return this.socialService.setTypingStatus(user.userId, friendId);
  }

  @Patch('messages/:messageId')
  @UseGuards(JwtAuthGuard)
  editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.socialService.editMessage(user.userId, messageId, dto);
  }

  @Post('messages/:messageId/reactions')
  @UseGuards(JwtAuthGuard)
  toggleMessageReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.socialService.toggleMessageReaction(user.userId, messageId, dto);
  }

  @Delete('messages/conversation/:friendId')
  @UseGuards(JwtAuthGuard)
  clearDirectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId') friendId: string,
  ) {
    return this.socialService.clearDirectConversation(user.userId, friendId);
  }

  @Delete('messages/:messageId')
  @UseGuards(JwtAuthGuard)
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
  ) {
    return this.socialService.deleteMessage(user.userId, messageId);
  }

  // ==================== ГРУППОВЫЕ ЧАТЫ ====================

  @Get('groups')
  @UseGuards(JwtAuthGuard)
  getMyGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.socialService.getMyGroups(user.userId);
  }

  @Post('groups')
  @UseGuards(JwtAuthGuard)
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.socialService.createGroup(user.userId, dto);
  }

  @Delete('groups/:groupId')
  @UseGuards(JwtAuthGuard)
  deleteGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.socialService.deleteGroup(user.userId, groupId);
  }

  @Post('groups/:groupId/members')
  @UseGuards(JwtAuthGuard)
  addGroupMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupMembersDto,
  ) {
    return this.socialService.addGroupMembers(user.userId, groupId, dto);
  }

  @Delete('groups/:groupId/members/:memberId')
  @UseGuards(JwtAuthGuard)
  removeGroupMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.socialService.removeGroupMember(user.userId, groupId, memberId);
  }

  @Get('groups/:groupId/messages')
  @UseGuards(JwtAuthGuard)
  getGroupMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.socialService.getGroupMessages(user.userId, groupId);
  }

  @Post('groups/:groupId/messages')
  @UseGuards(JwtAuthGuard)
  sendGroupMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.socialService.sendGroupMessage(user.userId, groupId, dto);
  }

  @Delete('groups/:groupId/messages')
  @UseGuards(JwtAuthGuard)
  clearGroupMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.socialService.clearGroupMessages(user.userId, groupId);
  }
}
